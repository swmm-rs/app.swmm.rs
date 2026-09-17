/**
 * Owner-bound node handle obtained with `simulation.nodes.get(id)`.
 *
 * The constructor is private. Use {@link NodeConfiguration.kind} to distinguish
 * junctions, storage nodes, outfalls, and dividers; there are no public subtype
 * classes. Reads return detached, frozen records. Mutations require explicit
 * methods, not assignments to those records.
 *
 * Operations reject when the owner is closed or failed, or the requested operation
 * is invalid for its lifecycle state or node kind. Wrong-kind calls do not mutate
 * the model. Read {@link statistics} before ending the run; hydraulic and quality
 * reads remain available in `ended`.
 */
export class Node {
    /** Canonical configured node ID. */
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new Node(id, call); }
    /**
     * Read current hydraulics in `running`, `complete`, or `ended`.
     * @returns A detached {@link NodeResults} record in project units, not a time series.
     */
    results() { return this.#call("node", this.id); }
    /**
     * Read common and kind-specific declarations in any healthy owner state.
     * @returns A detached {@link NodeConfiguration}; non-applicable subtype fields are `null`.
     */
    configuration() { return this.#call("nodeConfiguration", this.id); }
    /**
     * Atomically update declarations in `open` or `ended`.
     * An accepted edit in `ended` returns the owner to `open`.
     * @param patch - Sparse {@link NodePatch}. Omitted top-level fields retain their values.
     * @returns Resolves after the complete patch is accepted.
     * @throws Rejects for an invalid patch, wrong node kind, or invalid lifecycle state;
     * no part of a rejected patch is applied.
     * @example
     * ```typescript
     * import type { Node } from "@swmmrs/swmmrs";
     * declare const node: Node;
     * await node.configure({ fullDepth: 4.5, initialDepth: 0.25 });
     * ```
     */
    configure(patch) { return this.#call("configureNode", this.id, patch); }
    /**
     * Read the persistent additive API inflow in any healthy owner state.
     * @returns Inflow in project flow units, excluding other inflow sources.
     */
    externalInflow() { return this.#call("nodeExternalInflow", this.id); }
    /**
     * Set persistent additive API inflow in `open`, `running`, or `ended`.
     * @param flow - Inflow in project flow units. Zero removes the API contribution.
     * @returns Resolves after the forcing is updated.
     */
    setExternalInflow(flow) { return this.#call("setNodeExternalInflow", this.id, flow); }
    /**
     * Set a persistent fixed-stage override in `open`, `running`, or `ended`.
     * This runtime forcing is separate from {@link NodePatch.boundary}.
     * @param stage - Outfall boundary elevation in project length units (ft or m).
     * @returns Resolves after the forcing is updated.
     * @throws Rejects for a non-outfall node or an invalid stage or lifecycle state.
     */
    setOutfallStage(stage) { return this.#call("setOutfallStage", this.id, stage); }
    /**
     * Read the effective fixed stage in any healthy owner state; outfalls only.
     * @returns Runtime override if set, otherwise the declared fixed stage, in project
     * length units; `null` when neither supplies a fixed stage.
     * @throws Rejects for a non-outfall node.
     */
    fixedStage() { return this.#call("outfallFixedStage", this.id); }
    /**
     * Read current pollutant concentrations in `running`, `complete`, or `ended`.
     * @returns Detached {@link NodeQuality} arrays aligned with their pollutant IDs.
     */
    quality() { return this.#call("nodeQuality", this.id); }
    /**
     * Queue concentration overrides for the next quality-routing step; requires `running`.
     * The override expires after that step rather than becoming a persistent forcing.
     * @param values - Sparse pollutant-ID map of nonnegative concentrations in each
     * pollutant's configured concentration units.
     * @returns Resolves after the overrides are queued.
     * @throws Rejects invalid IDs, concentrations, or lifecycle states.
     */
    overridePollutantConcentrations(values) {
        return this.#call("overrideNodePollutantConcentrations", this.id, values);
    }
    /**
     * Read persistent external pollutant mass fluxes in `open`, `running`, or `ended`.
     * @returns A detached {@link PollutantValues} map in configured pollutant mass-flux units.
     */
    externalPollutantMassFlux() {
        return this.#call("nodeExternalPollutantMassFlux", this.id);
    }
    /**
     * Read one persistent external mass flux in `open`, `running`, or `ended`.
     * @param pollutantId - Configured pollutant ID.
     * @returns The pollutant's external mass flux in its configured mass-flux units.
     * @throws Rejects an unknown pollutant ID or invalid lifecycle state.
     */
    externalPollutantMassFluxValue(pollutantId) {
        return this.#call("nodeExternalPollutantMassFluxValue", this.id, pollutantId);
    }
    /**
     * Update persistent external pollutant mass fluxes in `open`, `running`, or `ended`.
     * @param values - Sparse pollutant-ID map in configured pollutant mass-flux units.
     * @param replace - Defaults to `false`: merge supplied IDs. With `true`, replace
     * the complete mapping and reset omitted pollutants to zero.
     * @returns Resolves after the atomic update.
     * @throws Rejects invalid pollutant IDs, values, or lifecycle states.
     */
    updateExternalPollutantMassFlux(values, replace = false) {
        return this.#call("updateNodeExternalPollutantMassFlux", this.id, values, replace);
    }
    /**
     * Reset all persistent external pollutant mass fluxes to zero.
     * Requires `open`, `running`, or `ended`; equivalent to
     * `updateExternalPollutantMassFlux({}, true)`.
     * @returns Resolves after the complete mapping is cleared.
     */
    clearExternalPollutantMassFlux() {
        return this.updateExternalPollutantMassFlux({}, true);
    }
    /**
     * Read cumulative node statistics in `running` or `complete`, before ending the run.
     * @returns A detached {@link NodeStatistics} record for the current run.
     */
    statistics() { return this.#call("nodeStatistics", this.id); }
    /**
     * Read storage-only statistics in `running` or `complete`.
     * @returns A detached {@link StorageStatistics} record for the current run.
     * @throws Rejects for a non-storage node or invalid lifecycle state.
     */
    storageStatistics() { return this.#call("storageStatistics", this.id); }
    /**
     * Read outfall-only statistics in `running` or `complete`.
     * @returns A detached {@link OutfallStatistics} record for the current run.
     * @throws Rejects for a non-outfall node or invalid lifecycle state.
     */
    outfallStatistics() { return this.#call("outfallStatistics", this.id); }
    /**
     * Read cumulative total inflow volume in `running` or `complete`.
     * @returns Volume in project volume units (ft³ or m³), not a flow rate.
     */
    totalInflowVolume() { return this.#call("nodeTotalInflowVolume", this.id); }
}
