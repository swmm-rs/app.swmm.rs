export class AmmModel {
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new AmmModel(id, call); }
    configuration() { return this.#call("ammModelConfiguration", this.id); }
    configure(patch) { return this.#call("configureAmmModel", this.id, patch); }
}
