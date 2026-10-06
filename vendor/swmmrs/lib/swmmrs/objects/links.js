/** Owner-bound link from `simulation.links.get(id)`. No public subtype subclasses.
 * Reads are detached; configuration is available in healthy states. Wrong-kind
 * operations reject without changing the model. Statistics require an active run.
 */
export class Link {
    /** Canonical configured link ID. */
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new Link(id, call); }
    /** Read hydraulics in `running`, `complete`, or `ended`.
     * @returns Detached current link results.
     */
    results() { return this.#call("link", this.id); }
    /** Read common and kind-specific declarations in any healthy owner state.
     * @returns Detached configuration, including cross-section and optional inlet.
     */
    configuration() { return this.#call("linkConfiguration", this.id); }
    /** Atomically update declarations in `open` or `ended`; accepted writes return `ended` to `open`.
     * @param patch - Sparse common/subtype fields; invalid fields or a wrong-kind subtype reject the whole patch.
     * @returns Resolves after all fields are accepted.
     */
    configure(patch) { return this.#call("configureLink", this.id, patch); }
    /** Change the target opening or pump speed in `running`; native control rules may change it later.
     * @param setting - Finite dimensionless factor. Non-pumps clamp to [0, 1]; pumps clamp at zero and may exceed one.
     * @returns Resolves after setting the target.
     */
    setTargetSetting(setting) { return this.#call("setLinkTargetSetting", this.id, setting); }
    /** Set a persistent flow limit in `open`, `running`, or `ended`.
     * @param flowLimit - Limit in project flow units.
     * @returns Resolves after the forcing is updated.
     */
    setFlowLimit(flowLimit) { return this.#call("setLinkFlowLimit", this.id, flowLimit); }
    /** Read quality in `running`, `complete`, or `ended`.
     * @returns Detached pollutant-aligned concentrations and transported loads.
     */
    quality() { return this.#call("linkQuality", this.id); }
    /** Queue sparse overrides for the next quality step in `running`; they expire after that step.
     * @param values - Pollutant-ID concentration map in configured concentration units.
     * @returns Resolves after valid IDs and concentrations are queued.
     */
    overridePollutantConcentrations(values) {
        return this.#call("overrideLinkPollutantConcentrations", this.id, values);
    }
    /** Read persistent pollutant mass fluxes in `open`, `running`, or `ended`.
     * @returns Pollutant-ID map in configured mass-flux units.
     */
    externalPollutantMassFlux() {
        return this.#call("linkExternalPollutantMassFlux", this.id);
    }
    /** Read one persistent mass flux in `open`, `running`, or `ended`.
     * @param pollutantId - Configured pollutant ID.
     * @returns Value in configured pollutant mass-flux units; unknown IDs reject.
     */
    externalPollutantMassFluxValue(pollutantId) {
        return this.#call("linkExternalPollutantMassFluxValue", this.id, pollutantId);
    }
    /** Update persistent mass fluxes in `open`, `running`, or `ended`.
     * Nonzero flux requires a non-dummy conduit; other kinds accept only an all-zero clear.
     * @param values - Pollutant-ID map in configured mass-flux units.
     * @param replace - Defaults to false: merge. True replaces the whole map, resetting omitted IDs to zero.
     * @returns Resolves after the atomic update.
     */
    updateExternalPollutantMassFlux(values, replace = false) {
        return this.#call("updateLinkExternalPollutantMassFlux", this.id, values, replace);
    }
    /** Read cumulative statistics in `running` or `complete`, before ending the run.
     * @returns Detached link statistics.
     */
    statistics() { return this.#call("linkStatistics", this.id); }
    /** Read pump-only cumulative statistics in `running` or `complete`.
     * @returns Detached pump statistics; non-pump calls reject.
     */
    pumpStatistics() { return this.#call("pumpStatistics", this.id); }
    /** Read the inlet placement in any healthy owner state.
     * @returns Detached inlet configuration, or null when absent.
     */
    inlet() { return this.#call("linkInlet", this.id); }
    /** Read inlet results in `running`, `complete`, or `ended`.
     * @returns Detached current inlet values, or null when no inlet is configured.
     */
    inletResults() { return this.#call("inletResults", this.id); }
    /** Update persistent inlet controls in `open`, `running`, or `ended`.
     * @param patch - Sparse clogging percentage and/or flow limit; omission retains a value.
     * @returns Resolves after the update is accepted.
     */
    updateInlet(patch) { return this.#call("updateInlet", this.id, patch); }
}
