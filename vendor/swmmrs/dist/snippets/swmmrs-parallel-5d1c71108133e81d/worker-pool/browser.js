// Worker lifecycle and cold atomic parking for the SWMMRS parallel Wasm backend.
let workers = [];
let hostModule;
let sharedMemory;
let atomicView;

function memoryView() {
    if (!atomicView || atomicView.buffer !== sharedMemory.buffer) {
        atomicView = new Int32Array(sharedMemory.buffer);
    }
    return atomicView;
}

export function waitForChange(address, expected, micros) {
    // Only child Workers park. The caller joins by polling in Wasm.
    Atomics.wait(memoryView(), address >>> 2, expected | 0, micros / 1000);
}

export function notifyChange(address) {
    Atomics.notify(memoryView(), address >>> 2);
}

export function runCaller() {
    hostModule.swmmrsParallelCaller();
}

export function stopWorkers() {
    for (const worker of workers) worker.terminate();
    workers = [];
}

export async function startWorkers(module, memory, moduleUrl, threads) {
    if (!(memory.buffer instanceof SharedArrayBuffer) || !globalThis.crossOriginIsolated) {
        throw new Error("SWMMRS parallel requires shared Wasm memory and cross-origin isolation");
    }
    sharedMemory = memory;
    hostModule = await import(moduleUrl);
    for (const name of ["initSync", "swmmrsParallelWorker", "swmmrsParallelWorkerFailed", "swmmrsParallelCaller"]) {
        if (typeof hostModule[name] !== "function") {
            throw new Error(`SWMMRS parallel module is missing export ${name}`);
        }
    }
    try {
        await Promise.all(Array.from({ length: threads - 1 }, (_, index) => {
            const lane = index + 1;
            const worker = new Worker(new URL(import.meta.url), {
                type: "module",
                name: "swmmrs_parallel_worker",
            });
            workers.push(worker);
            return new Promise((resolve, reject) => {
                const onError = event => {
                    reject(new Error(`SWMMRS parallel worker ${lane} failed: ${event.message || "message error"}`));
                };
                const onMessage = event => {
                    if (event.data?.type === "swmmrs_parallel_ready") {
                        worker.removeEventListener("message", onMessage);
                        worker.removeEventListener("error", onError);
                        worker.removeEventListener("messageerror", onError);
                        resolve();
                    } else if (event.data?.type === "swmmrs_parallel_error") {
                        reject(new Error(`SWMMRS parallel worker ${lane}: ${event.data.message}`));
                    }
                };
                worker.addEventListener("message", onMessage);
                worker.addEventListener("error", onError);
                worker.addEventListener("messageerror", onError);
                worker.postMessage({ type: "swmmrs_parallel_init", module, memory, moduleUrl, lane });
            });
        }));
    } catch (error) {
        stopWorkers();
        throw error;
    }
}

if (globalThis.name === "swmmrs_parallel_worker") {
    self.addEventListener("message", async function initialize(event) {
        if (event.data?.type !== "swmmrs_parallel_init") return;
        self.removeEventListener("message", initialize);
        const { module, memory, moduleUrl, lane } = event.data;
        let pkg;
        let initialized = false;
        try {
            sharedMemory = memory;
            pkg = await import(moduleUrl);
            pkg.initSync({ module, memory });
            initialized = true;
            self.postMessage({ type: "swmmrs_parallel_ready" });
            pkg.swmmrsParallelWorker(lane);
        } catch (error) {
            // This executes on the failed Worker, so the shared join is released
            // even while the Simulation Worker is synchronously waiting for it.
            if (initialized) pkg.swmmrsParallelWorkerFailed(lane);
            self.postMessage({ type: "swmmrs_parallel_error", message: String(error) });
        }
    });
}
