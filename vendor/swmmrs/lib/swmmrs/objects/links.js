export class Link {
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new Link(id, call); }
    results() { return this.#call("link", this.id); }
    configuration() { return this.#call("linkConfiguration", this.id); }
    configure(patch) { return this.#call("configureLink", this.id, patch); }
    /** Dimensionless target opening or pump speed. */
    setTargetSetting(setting) { return this.#call("setLinkTargetSetting", this.id, setting); }
    setFlowLimit(flowLimit) { return this.#call("setLinkFlowLimit", this.id, flowLimit); }
    quality() { return this.#call("linkQuality", this.id); }
    overridePollutantConcentrations(values) {
        return this.#call("overrideLinkPollutantConcentrations", this.id, values);
    }
    externalPollutantMassFlux() {
        return this.#call("linkExternalPollutantMassFlux", this.id);
    }
    externalPollutantMassFluxValue(pollutantId) {
        return this.#call("linkExternalPollutantMassFluxValue", this.id, pollutantId);
    }
    updateExternalPollutantMassFlux(values, replace = false) {
        return this.#call("updateLinkExternalPollutantMassFlux", this.id, values, replace);
    }
    statistics() { return this.#call("linkStatistics", this.id); }
    pumpStatistics() { return this.#call("pumpStatistics", this.id); }
    inlet() { return this.#call("linkInlet", this.id); }
    inletResults() { return this.#call("inletResults", this.id); }
    updateInlet(patch) { return this.#call("updateInlet", this.id, patch); }
}
