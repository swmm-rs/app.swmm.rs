import { WorkerClient } from "./client.js";
import { LifecycleError, WorkerError } from "./exceptions.js";
import { ObjectCollection, NodeCollection, LinkCollection, SubcatchmentCollection, RainGageCollection } from "./objects/collections.js";
import { SimulationOptionsView } from "./objects/options.js";
import { Definition, Aquifer, SnowmeltParameterSet } from "./objects/definitions.js";
import { AmmModel } from "./objects/amm.js";
import { UnitHydrograph } from "./objects/rtk.js";
import { LidControl } from "./objects/lids.js";
import { bytes, createWorker, runtimeInfo } from "./runtime.js";
/** One isolated worker and project. Always await close() when finished. */
export class Simulation {
    nodes;
    links;
    subcatchments;
    rainGages;
    options;
    pollutants;
    landUses;
    timePatterns;
    curves;
    timeSeries;
    controls;
    transects;
    aquifers;
    snowmeltSets;
    shapes;
    streets;
    inletDesigns;
    ammModels;
    unitHydrographs;
    lidControls;
    #client;
    #iterating = false;
    #advancing = false;
    #closed = false;
    #terminateRequested = false;
    constructor(client, info) {
        this.#client = client;
        const assertOpen = () => client.assertOpen();
        this.nodes = NodeCollection.create(info.nodeIds, client.call, assertOpen);
        this.links = LinkCollection.create(info.linkIds, client.call, assertOpen);
        this.subcatchments = SubcatchmentCollection.create(info.subcatchmentIds, client.call, assertOpen);
        this.rainGages = RainGageCollection.create(info.rainGageIds, client.call, assertOpen);
        this.options = SimulationOptionsView.create(client.call);
        this.pollutants = new ObjectCollection(info.pollutantIds, id => Definition.create(id, client.call), assertOpen);
        this.landUses = new ObjectCollection(info.landUseIds, id => Definition.create(id, client.call), assertOpen);
        this.timePatterns = new ObjectCollection(info.timePatternIds, id => Definition.create(id, client.call), assertOpen);
        this.curves = new ObjectCollection(info.curveIds, id => Definition.create(id, client.call), assertOpen);
        this.timeSeries = new ObjectCollection(info.timeSeriesIds, id => Definition.create(id, client.call), assertOpen);
        this.controls = new ObjectCollection(info.controlIds, id => Definition.create(id, client.call), assertOpen);
        this.transects = new ObjectCollection(info.transectIds, id => Definition.create(id, client.call), assertOpen);
        this.aquifers = new ObjectCollection(info.aquiferIds, id => Aquifer.create(id, client.call), assertOpen);
        this.snowmeltSets = new ObjectCollection(info.snowmeltIds, id => SnowmeltParameterSet.create(id, client.call), assertOpen);
        this.shapes = new ObjectCollection(info.shapeIds, id => Definition.create(id, client.call), assertOpen);
        this.streets = new ObjectCollection(info.streetIds, id => Definition.create(id, client.call), assertOpen);
        this.inletDesigns = new ObjectCollection(info.inletDesignIds, id => Definition.create(id, client.call), assertOpen);
        this.ammModels = new ObjectCollection(info.ammModelIds, id => AmmModel.create(id, client.call), assertOpen);
        this.unitHydrographs = new ObjectCollection(info.unitHydrographIds, id => UnitHydrograph.create(id, client.call), assertOpen);
        this.lidControls = new ObjectCollection(info.lidControlIds, id => LidControl.create(id, client.call), assertOpen);
    }
    /** Input is file contents. External keys are paths relative to the INP file. */
    static async open(input, files = {}, options = {}) {
        const { maxThreads, defaultThreads, parallel } = await runtimeInfo();
        const threads = options.threads ?? defaultThreads;
        validateThreads(threads, maxThreads, parallel);
        const stagedFiles = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, value]) => [name, await bytes(value)])));
        const inputBytes = await bytes(input);
        const client = new WorkerClient(await createWorker(options));
        try {
            const info = await client.call("open", inputBytes, stagedFiles, threads);
            return new Simulation(client, info);
        }
        catch (error) {
            client.stop(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /** Restore a checkpoint in an independent worker without rerunning the model. */
    static async resume(checkpoint, options = {}) {
        const { maxThreads, defaultThreads, parallel } = await runtimeInfo();
        const threads = options.threads ?? defaultThreads;
        validateThreads(threads, maxThreads, parallel);
        const client = new WorkerClient(await createWorker(options));
        try {
            return new Simulation(client, await client.call("resumeCheckpoint", checkpoint, threads));
        }
        catch (error) {
            client.stop(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    getState() { return this.#closed ? Promise.resolve("closed") : this.#client.call("state"); }
    info() { return this.#client.call("info"); }
    status() { return this.#client.call("status"); }
    updateSchedule(patch) { return this.#advance("updateSchedule", () => this.#client.call("updateSchedule", patch)); }
    ammAssignments() { return this.#client.call("ammAssignments"); }
    replaceAmmAssignments(assignments) { return this.#client.call("replaceAmmAssignments", assignments); }
    rdiiAssignments() { return this.#client.call("rdiiAssignments"); }
    replaceRdiiAssignments(assignments) { return this.#client.call("replaceRdiiAssignments", assignments); }
    useHotstart(input) {
        return this.#advance("useHotstart", async () => this.#client.call("useHotstart", input === null ? null : await bytes(input)));
    }
    saveHotstart() { return this.#client.call("saveHotstart"); }
    saveCheckpoint() { return this.#client.call("exportCheckpoint"); }
    loadCheckpointState(checkpoint) {
        return this.#advance("loadCheckpointState", () => this.#client.call("loadCheckpointState", checkpoint));
    }
    async fork(options = {}) {
        return Simulation.resume(await this.saveCheckpoint(), options);
    }
    start({ saveResults = true } = {}) {
        validateSaveResults(saveResults);
        return this.#advance("start", () => this.#client.call("start", saveResults));
    }
    step() { return this.#advance("step", () => this.#client.call("step")); }
    async stride(seconds, strict = true) {
        validateSeconds(seconds);
        if (typeof strict !== "boolean")
            throw new TypeError("strict must be a boolean");
        return this.#advance("stride", () => this.#client.call("stride", seconds, strict));
    }
    /** Automatic start and advancement; exhaustion retains final statistics. */
    [Symbol.asyncIterator]() { return this.steps(); }
    /** Early exit releases iterator ownership and leaves the run available to finish or resume. */
    async *steps({ seconds, strict = true, saveResults = true } = {}) {
        if (seconds !== undefined)
            validateSeconds(seconds);
        validateSaveResults(saveResults);
        if (typeof strict !== "boolean")
            throw new TypeError("strict must be a boolean");
        this.#assertManual("iterate");
        this.#iterating = true;
        try {
            const state = await this.#client.call("state");
            if (state === "open" || state === "ended")
                await this.#client.call("start", saveResults);
            if (state === "complete")
                return;
            while (true) {
                if (this.#terminateRequested) {
                    await this.#client.call("end");
                    return;
                }
                const time = seconds === undefined
                    ? await this.#client.call("step")
                    : await this.#client.call("stride", seconds, strict);
                if (time === null)
                    return;
                yield time;
            }
        }
        finally {
            this.#iterating = false;
            this.#terminateRequested = false;
        }
    }
    /** End active iteration at its next observation boundary, without closing the owner. */
    terminate() {
        if (!this.#iterating)
            throw new LifecycleError({ message: "No active iterator owns advancement", operation: "terminate" });
        this.#terminateRequested = true;
    }
    #assertManual(operation) {
        this.#client.assertOpen();
        if (this.#iterating)
            throw new LifecycleError({ message: "An active iterator owns simulation advancement", operation });
        if (this.#advancing)
            throw new LifecycleError({ message: "A simulation advancement is already pending", operation });
    }
    async #advance(operation, execute) {
        this.#assertManual(operation);
        this.#advancing = true;
        try {
            return await execute();
        }
        finally {
            this.#advancing = false;
        }
    }
    /** Direct result reads retained for existing prototype callers. */
    node(id) { return this.#client.call("node", id); }
    link(id) { return this.#client.call("link", id); }
    setNodeExternalInflow(id, flow) { return this.#client.call("setNodeExternalInflow", id, flow); }
    setLinkTargetSetting(id, setting) { return this.#client.call("setLinkTargetSetting", id, setting); }
    /** Available while running or complete, before finish() ends the run. */
    statistics() { return this.#client.call("statistics"); }
    /** Finalize report and binary output, retaining the owner for result reads and reruns. */
    finish() { return this.#advance("finish", () => this.#client.call("finish")); }
    /** Start and run to completion with one worker request. */
    run({ saveResults = true } = {}) {
        validateSaveResults(saveResults);
        return this.#advance("run", () => this.#client.call("run", saveResults));
    }
    /** End computation and flush binary output and summary statistics without detailed tables. */
    end() { return this.#advance("end", () => this.#client.call("end")); }
    /** Generate and flush the detailed report and footer for an ended run, once. */
    report() { return this.#advance("report", () => this.#client.call("report")); }
    resetSolver() { return this.#advance("resetSolver", () => this.#client.call("resetSolver")); }
    sleepWorkers() { return this.#client.call("sleepWorkers"); }
    readFile(name) { return this.#client.call("readFile", name); }
    /** Release the project and its workers. Repeated calls share cleanup. */
    async close() {
        try {
            await this.#client.close();
        }
        finally {
            this.#closed = true;
        }
    }
    [Symbol.asyncDispose]() { return this.close(); }
}
function validateSeconds(seconds) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 2_147_483_647)
        throw new RangeError("seconds must be a positive 32-bit integer");
}
function validateSaveResults(value) {
    if (typeof value !== "boolean")
        throw new TypeError("saveResults must be a boolean");
}
function validateThreads(threads, maximum, parallel) {
    if (!Number.isInteger(threads) || threads < 1)
        throw new RangeError(`threads must be an integer between 1 and ${maximum}`);
    if (threads > 1 && !parallel)
        throw new WorkerError({ message: "Multiple threads require cross-origin isolation with COOP/COEP headers; use threads: 1 for serial execution", operation: "open" });
    if (threads > maximum)
        throw new RangeError(`threads must be an integer between 1 and ${maximum}`);
}
/** Run one INP model and return its report and binary output after cleanup. */
export async function runSwmm(input, files = {}, options = {}) {
    const simulation = await Simulation.open(input, files, options);
    let failure;
    try {
        return await simulation.run(options);
    }
    catch (error) {
        failure = error;
        throw error;
    }
    finally {
        try {
            await simulation.close();
        }
        catch (cleanupError) {
            if (failure === undefined)
                throw cleanupError;
            if (failure instanceof Error)
                Object.assign(failure, { cleanupError });
        }
    }
}
