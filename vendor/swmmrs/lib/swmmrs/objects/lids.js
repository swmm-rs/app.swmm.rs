export class LidControl {
    id;
    #call;
    constructor(id, call) {
        this.id = id;
        this.#call = call;
        Object.freeze(this);
    }
    /** @internal */
    static create(id, call) { return new LidControl(id, call); }
    configuration() { return this.#call("lidControlConfiguration", this.id); }
    configure(layer, patch) {
        return this.#call("configureLidControl", this.id, layer, patch);
    }
}
export class LidUnit {
    subcatchmentId;
    index;
    #call;
    constructor(subcatchmentId, index, call) {
        this.subcatchmentId = subcatchmentId;
        this.index = index;
        this.#call = call;
        Object.freeze(this);
    }
    /** @internal */
    static create(subcatchmentId, index, call) {
        return new LidUnit(subcatchmentId, index, call);
    }
    configuration() {
        return this.#call("lidUnitConfiguration", this.subcatchmentId, this.index);
    }
    configure(patch) {
        return this.#call("configureLidUnit", this.subcatchmentId, this.index, patch);
    }
    snapshot() {
        return this.#call("lidUnitSnapshot", this.subcatchmentId, this.index);
    }
}
/** Asynchronously indexed LID units owned by one subcatchment. */
export class LidUnitCollection {
    subcatchmentId;
    #call;
    constructor(subcatchmentId, call) {
        this.subcatchmentId = subcatchmentId;
        this.#call = call;
        Object.freeze(this);
    }
    /** @internal */
    static create(subcatchmentId, call) {
        return new LidUnitCollection(subcatchmentId, call);
    }
    count() { return this.#call("lidUnitCount", this.subcatchmentId); }
    async at(index) {
        if (!Number.isInteger(index) || index < 0)
            throw new RangeError(`LID unit index out of range: ${index}`);
        const count = await this.count();
        if (index >= count)
            throw new RangeError(`LID unit index out of range: ${index}`);
        return LidUnit.create(this.subcatchmentId, index, this.#call);
    }
}
