/** Editable AMM definition from `simulation.ammModels`; node assignments are managed on the simulation. */
export class AmmModel {
    /** Canonical configured model ID. */
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new AmmModel(id, call); }
    /** Read the definition in any healthy owner state.
     * @returns Detached complete AMM configuration.
     */
    configuration() { return this.#call("ammModelConfiguration", this.id); }
    /** Atomically update an AMM definition in `open` or `ended`; accepted edits return the owner to `open`.
     * @param patch - Sparse fields; supplying components replaces the complete array.
     * @returns Resolves after all fields are accepted.
     */
    configure(patch) { return this.#call("configureAmmModel", this.id, patch); }
}
