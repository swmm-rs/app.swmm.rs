/** A read-only identity handle for a configured model definition. */
export class Definition {
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
export class Aquifer extends Definition {
    constructor(id, call) { super(id, call); }
    /** @internal */
    static create(id, call) { return new Aquifer(id, call); }
    configuration() {
        return this.call("aquiferConfiguration", this.id);
    }
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
    configuration() {
        return this.call("snowmeltConfiguration", this.id);
    }
    configure(patch) {
        return this.call("configureSnowmelt", this.id, patch);
    }
    surfaceConfiguration(surface) {
        return this.call("snowmeltSurfaceConfiguration", this.id, surface);
    }
    configureSurface(surface, patch) {
        return this.call("configureSnowmeltSurface", this.id, surface, patch);
    }
}
