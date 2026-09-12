const encoder = new TextEncoder();
const runtimeGlobal = globalThis;
/** True when this module is running in Node rather than a browser page/worker. */
export const isNodeRuntime = typeof runtimeGlobal.process?.versions?.node === "string";
function hardwareConcurrency() {
    const browserValue = runtimeGlobal.navigator?.hardwareConcurrency;
    if (typeof browserValue === "number" && Number.isFinite(browserValue) && browserValue > 0)
        return Math.floor(browserValue);
    const os = runtimeGlobal.process?.getBuiltinModule?.("node:os");
    const nodeValue = os?.availableParallelism?.();
    return typeof nodeValue === "number" && Number.isFinite(nodeValue) && nodeValue > 0 ? Math.floor(nodeValue) : 1;
}
const hostThreadCapacity = hardwareConcurrency();
async function runtimeCapacity() {
    if (!isNodeRuntime || runtimeGlobal.navigator?.hardwareConcurrency !== undefined || hostThreadCapacity > 1) {
        return hostThreadCapacity;
    }
    const os = await dynamicImport("node:os");
    const value = os.availableParallelism?.();
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : hostThreadCapacity;
}
/** Return host solver capacity without requiring browser globals in Node. */
export async function runtimeInfo() {
    const parallel = isNodeRuntime || Boolean(runtimeGlobal.crossOriginIsolated);
    const maxThreads = await runtimeCapacity();
    return {
        maxThreads,
        defaultThreads: isNodeRuntime ? 1 : parallel ? maxThreads : 1,
        parallel,
    };
}
async function dynamicImport(specifier) {
    return import(specifier);
}
function messageError(reason) {
    return reason instanceof Error ? reason : new Error(String(reason));
}
/** DOM-shaped adapter around node:worker_threads.Worker. */
class NodeWorkerAdapter {
    #worker;
    #terminated = false;
    #failed = false;
    #pendingError;
    #onerror = null;
    onmessage = null;
    onmessageerror = null;
    get onerror() {
        return this.#onerror;
    }
    set onerror(handler) {
        this.#onerror = handler;
        const pending = this.#pendingError;
        if (handler && pending) {
            this.#pendingError = undefined;
            queueMicrotask(() => handler(this.#errorEvent(pending)));
        }
    }
    constructor(worker) {
        this.#worker = worker;
        worker.on("message", (data) => this.onmessage?.({ data }));
        worker.on("messageerror", (error) => this.onmessageerror?.({ data: error }));
        worker.on("error", (error) => this.#reportError(error));
        worker.on("exit", (code) => {
            if (!this.#terminated && code !== 0)
                this.#reportError(new Error(`SWMM worker exited with code ${code}`));
            else if (!this.#terminated && code === 0)
                this.#reportError(new Error("SWMM worker exited unexpectedly"));
        });
    }
    postMessage(message, transfer) {
        this.#worker.postMessage(message, transfer);
    }
    terminate() {
        this.#terminated = true;
        void this.#worker.terminate();
    }
    #errorEvent(error) {
        return { message: error.message, error, preventDefault() { } };
    }
    #reportError(reason) {
        if (this.#terminated || this.#failed)
            return;
        this.#failed = true;
        const error = messageError(reason);
        if (this.#onerror)
            this.#onerror(this.#errorEvent(error));
        else
            this.#pendingError = error;
    }
}
/** Convert supported model input values to bytes without requiring browser globals. */
export async function bytes(value) {
    if (typeof value === "string")
        return encoder.encode(value);
    if (typeof Blob !== "undefined" && value instanceof Blob)
        return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer)
        return new Uint8Array(value);
    if (ArrayBuffer.isView(value))
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError("SWMM files must be strings, Blobs, ArrayBuffers, or typed arrays");
}
function wasmInitializer(bindings) {
    if (!bindings || typeof bindings !== "object" || !("default" in bindings)) {
        throw new TypeError("WASM bindings must export a default initializer");
    }
    const initializer = bindings.default;
    if (typeof initializer !== "function")
        throw new TypeError("WASM bindings must export a default initializer");
    return initializer;
}
/** Read a generated wasm file from disk in Node. Browser callers should use loadWasm. */
export async function wasmInput(url) {
    if (!isNodeRuntime)
        throw new Error("wasmInput is only available in Node");
    const fs = await dynamicImport("node:fs/promises");
    const value = await fs.readFile(url);
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
/** Initialize generated wasm with file bytes in Node and its normal URL loader in browsers. */
export async function loadWasm(bindings, moduleUrl) {
    const initializer = wasmInitializer(bindings);
    if (!isNodeRuntime)
        return initializer();
    return initializer({ module_or_path: await wasmInput(new URL("./swmmrs_bg.wasm", moduleUrl)) });
}
/** Create one isolated worker using browser Worker or node:worker_threads. */
export async function createWorker(options = {}) {
    if (!isNodeRuntime) {
        const WorkerConstructor = runtimeGlobal.Worker;
        if (typeof WorkerConstructor !== "function")
            throw new Error("SWMM needs browser workers");
        const url = options.workerUrl ?? new URL("./worker.js", import.meta.url);
        return new WorkerConstructor(url, { type: "module" });
    }
    const { Worker: NodeWorker } = await dynamicImport("node:worker_threads");
    if (!NodeWorker)
        throw new Error("Node worker_threads are unavailable");
    const target = options.workerUrl ?? new URL("./worker.js", import.meta.url);
    const bootstrap = new URL("../../worker-node.js", import.meta.url);
    return new NodeWorkerAdapter(new NodeWorker(bootstrap, {
        type: "module",
        workerData: { target: target instanceof URL ? target.href : target, name: "" },
    }));
}
