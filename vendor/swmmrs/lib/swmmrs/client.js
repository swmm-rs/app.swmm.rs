import { fromWorkerError, LifecycleError, WorkerError } from "./exceptions.js";
/** Private transport for the worker shipped with this package. */
export class WorkerClient {
    #worker;
    #pending = new Map();
    #nextId = 0;
    #failure;
    #closing;
    constructor(worker) {
        this.#worker = worker;
        worker.onerror = (event) => {
            event.preventDefault();
            this.stop(new WorkerError({ message: event.message || "SWMM worker failed" }));
        };
        worker.onmessageerror = () => this.stop(new WorkerError({ message: "Cannot read SWMM worker response" }));
        worker.onmessage = ({ data }) => {
            const pending = this.#pending.get(data.id);
            if (!pending)
                return;
            this.#pending.delete(data.id);
            if (data.ok)
                pending.resolve(freezeRecord(data.result));
            else {
                const error = fromWorkerError(data.error);
                pending.reject(error);
                if (data.fatal)
                    this.stop(error);
            }
        };
    }
    assertOpen() {
        if (this.#failure)
            throw this.#failure;
        if (this.#closing)
            throw new LifecycleError({ message: "Simulation is closing", operation: "close" });
    }
    call = (method, ...args) => {
        try {
            this.assertOpen();
        }
        catch (error) {
            return Promise.reject(error);
        }
        const id = this.#nextId++;
        return new Promise((resolve, reject) => {
            // The bundled worker implements the same Operations contract. This is the
            // only type erasure needed to correlate request IDs with response values.
            this.#pending.set(id, { resolve: (value) => resolve(value), reject });
            try {
                this.#worker.postMessage({ id, method, args });
            }
            catch (error) {
                this.#pending.delete(id);
                reject(error);
            }
        });
    };
    stop(error) {
        this.#failure ??= error;
        try {
            this.#worker.terminate();
        }
        catch { /* The worker may already have exited. */ }
        for (const pending of this.#pending.values())
            pending.reject(this.#failure);
        this.#pending.clear();
    }
    close() {
        this.#closing ??= this.call("close").finally(() => this.stop(new LifecycleError({ message: "Simulation is closed", operation: "close" })));
        return this.#closing;
    }
}
/** Freeze copied domain records; output bytes remain caller-owned typed arrays. */
function freezeRecord(value) {
    if (value && typeof value === "object" && !ArrayBuffer.isView(value)) {
        for (const item of Object.values(value))
            freezeRecord(item);
        Object.freeze(value);
    }
    return value;
}
