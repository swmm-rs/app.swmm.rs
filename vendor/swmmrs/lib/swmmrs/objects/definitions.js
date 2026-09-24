/** Read-only identity for a configured definition. Generic handles do not expose editable curve/time-series data. */
export class Definition {
    /** Canonical configured definition ID. */
    id;
    call;
    constructor(id, call) {
        this.id = id;
        this.call = call;
        Object.freeze(this);
    }
    /** @internal */
    static create(id, call) { return new Definition(id, call); }
}
/** Editable aquifer handle obtained from `simulation.aquifers`. */
export class Aquifer extends Definition {
    constructor(id, call) { super(id, call); }
    /** @internal */
    static create(id, call) { return new Aquifer(id, call); }
    /** Read aquifer declarations in any healthy owner state.
     * @returns Detached aquifer configuration in project units.
     */
    configuration() {
        return this.call("aquiferConfiguration", this.id);
    }
    /** Atomically update aquifer declarations in `open` or `ended`; accepted edits return the owner to `open`.
     * @param patch - Sparse field values; null clears the optional time-pattern relationship.
     * @returns Resolves after all fields are accepted.
     */
    configure(patch) {
        return this.call("configureAquifer", this.id, patch);
    }
}
/** Editable snowmelt parameter-set identity handle. */
export class SnowmeltParameterSet extends Definition {
    constructor(id, call) { super(id, call); }
    /** @internal */
    static create(id, call) {
        return new SnowmeltParameterSet(id, call);
    }
    /** Read all parameter-set declarations in a healthy owner state.
     * @returns Detached parameter set with three surface records.
     */
    configuration() {
        return this.call("snowmeltConfiguration", this.id);
    }
    /** Atomically update set-level declarations in `open` or `ended`; accepted edits return the owner to `open`.
     * @param patch - Sparse set fields; null clears the optional receiving-subcatchment relation.
     * @returns Resolves after the update is accepted.
     */
    configure(patch) {
        return this.call("configureSnowmelt", this.id, patch);
    }
    /** Read one surface in a healthy owner state.
     * @param surface - Plowable, impervious, or pervious surface selector.
     * @returns Detached surface parameters.
     */
    surfaceConfiguration(surface) {
        return this.call("snowmeltSurfaceConfiguration", this.id, surface);
    }
    /** Atomically update one surface in `open` or `ended`; accepted edits return the owner to `open`.
     * @param surface - Surface to update.
     * @param patch - Sparse surface values; omitted fields retain their values.
     * @returns Resolves after all supplied fields are accepted.
     */
    configureSurface(surface, patch) {
        return this.call("configureSnowmeltSurface", this.id, surface, patch);
    }
}
