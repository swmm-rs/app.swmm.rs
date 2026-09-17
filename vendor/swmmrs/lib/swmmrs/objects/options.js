/** Stable model options. Updates are atomic and require an open or ended run. */
export class SimulationOptionsView {
    #call;
    constructor(call) { this.#call = call; }
    /** @internal */
    static create(call) { return new SimulationOptionsView(call); }
    /** Read the complete option record in a healthy owner state.
     * @returns Detached {@link ModelOptions}, including read-only solver tolerances.
     */
    read() { return this.#call("options"); }
    /** Atomically update model options in `open` or `ended`; accepted edits return `ended` to `open`.
     * @param patch - Sparse option values. Unknown keys, invalid types/enums, and solver-invalid values reject the whole patch.
     * @returns Resolves after all supplied fields are accepted.
     * @example
     * ```typescript
     * import type { Simulation } from "@swmmrs/swmmrs";
     * declare const simulation: Simulation;
     * await simulation.options.update({ routingStepSeconds: 30, reportStepSeconds: 300, qualityEnabled: true });
     * ```
     */
    update(patch) { return this.#call("configureOptions", patch); }
    /** Read the maximum routing interval allowed by current configuration.
     * @returns Maximum routing interval in seconds.
     */
    maximumRoutingStepSeconds() { return this.#call("maximumRoutingStepSeconds"); }
}
