export class UnitHydrograph {
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new UnitHydrograph(id, call); }
    configuration() { return this.#call("unitHydrographConfiguration", this.id); }
    configure(patch) { return this.#call("configureUnitHydrograph", this.id, patch); }
}
