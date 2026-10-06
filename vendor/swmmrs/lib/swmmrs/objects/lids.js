/** Shared LID-control handle obtained from `simulation.lidControls`. */
export class LidControl {
    /** Canonical configured control ID. */
    id;
    #call;
    constructor(id, call) {
        this.id = id;
        this.#call = call;
        Object.freeze(this);
    }
    /** @internal */
    static create(id, call) { return new LidControl(id, call); }
    /** Read configured layers in a healthy owner state.
     * @returns Detached layer records; absent layers are null. Derived fields retain their last prepared values until preparation.
     */
    configuration() { return this.#call("lidControlConfiguration", this.id); }
    configure(layer, patch) {
        return this.#call("configureLidControl", this.id, layer, patch);
    }
}
/** LID usage handle identified by its subcatchment and local index. */
export class LidUnit {
    /** Canonical owning subcatchment ID. */
    subcatchmentId;
    /** Zero-based position within the owning subcatchment's LID usages. */
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
    /** Read usage declarations in a healthy owner state.
     * @returns Detached configuration in project units.
     */
    configuration() {
        return this.#call("lidUnitConfiguration", this.subcatchmentId, this.index);
    }
    /** Atomically update this usage in `open` or `ended`; accepted edits return the owner to `open`.
     * @param patch - Sparse usage declarations; null restores implicit drain routing.
     * @returns Resolves after all supplied fields are accepted.
     */
    configure(patch) {
        return this.#call("configureLidUnit", this.subcatchmentId, this.index, patch);
    }
    /** Read detached water balance and layer results in `running` or `complete`, before `end()`.
     * @returns One usage's current results; later steps do not mutate them.
     */
    snapshot() {
        return this.#call("lidUnitSnapshot", this.subcatchmentId, this.index);
    }
}
/** Asynchronously indexed LID units owned by one subcatchment. */
export class LidUnitCollection {
    /** Canonical owning subcatchment ID. */
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
    /** Read the number of configured usages; unlike model collections this queries the worker.
     * @returns Subcatchment-local usage count.
     */
    count() { return this.#call("lidUnitCount", this.subcatchmentId); }
    /** Resolve one subcatchment-local usage in a healthy owner state.
     * @param index - Zero-based usage index, not a configured LID-control index.
     * @returns New handle for the selected usage.
     * @throws `RangeError` if the index is non-integral, negative, or out of range.
     */
    async at(index) {
        if (!Number.isInteger(index) || index < 0)
            throw new RangeError(`LID unit index out of range: ${index}`);
        const count = await this.count();
        if (index >= count)
            throw new RangeError(`LID unit index out of range: ${index}`);
        return LidUnit.create(this.subcatchmentId, index, this.#call);
    }
}
