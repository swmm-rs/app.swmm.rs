/** Stable model options. Updates are atomic and require an open or ended run. */
export class SimulationOptionsView {
    #call;
    constructor(call) { this.#call = call; }
    /** @internal */
    static create(call) { return new SimulationOptionsView(call); }
    read() { return this.#call("options"); }
    update(patch) { return this.#call("configureOptions", patch); }
    maximumRoutingStepSeconds() { return this.#call("maximumRoutingStepSeconds"); }
}
