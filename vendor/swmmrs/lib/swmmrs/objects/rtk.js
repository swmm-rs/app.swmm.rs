/** Editable RTK definition from `simulation.unitHydrographs`; node assignments are separate. */
export class UnitHydrograph {
    /** Canonical configured hydrograph ID. */
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new UnitHydrograph(id, call); }
    /** Read the definition in any healthy owner state.
     * @returns Detached rain-gage identity and complete twelve-month response matrix.
     */
    configuration() { return this.#call("unitHydrographConfiguration", this.id); }
    /** Atomically update an RTK definition in `open` or `ended`; accepted edits return the owner to `open`.
     * @param patch - Sparse fields; a monthly array replaces all twelve months.
     * @returns Resolves after the complete patch is accepted.
     */
    configure(patch) { return this.#call("configureUnitHydrograph", this.id, patch); }
}
