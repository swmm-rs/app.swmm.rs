export class Node {
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new Node(id, call); }
    results() { return this.#call("node", this.id); }
    configuration() { return this.#call("nodeConfiguration", this.id); }
    configure(patch) { return this.#call("configureNode", this.id, patch); }
    externalInflow() { return this.#call("nodeExternalInflow", this.id); }
    /** Runtime inflow in project flow units. */
    setExternalInflow(flow) { return this.#call("setNodeExternalInflow", this.id, flow); }
    /** Runtime outfall boundary in project length units. Requires an outfall. */
    setOutfallStage(stage) { return this.#call("setOutfallStage", this.id, stage); }
    fixedStage() { return this.#call("outfallFixedStage", this.id); }
    quality() { return this.#call("nodeQuality", this.id); }
    overridePollutantConcentrations(values) {
        return this.#call("overrideNodePollutantConcentrations", this.id, values);
    }
    externalPollutantMassFlux() {
        return this.#call("nodeExternalPollutantMassFlux", this.id);
    }
    externalPollutantMassFluxValue(pollutantId) {
        return this.#call("nodeExternalPollutantMassFluxValue", this.id, pollutantId);
    }
    updateExternalPollutantMassFlux(values, replace = false) {
        return this.#call("updateNodeExternalPollutantMassFlux", this.id, values, replace);
    }
    clearExternalPollutantMassFlux() {
        return this.updateExternalPollutantMassFlux({}, true);
    }
    statistics() { return this.#call("nodeStatistics", this.id); }
    storageStatistics() { return this.#call("storageStatistics", this.id); }
    outfallStatistics() { return this.#call("outfallStatistics", this.id); }
    totalInflowVolume() { return this.#call("nodeTotalInflowVolume", this.id); }
}
