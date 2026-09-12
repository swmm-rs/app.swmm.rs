import { ObjectNotFoundError } from "../exceptions.js";
import { Node } from "./nodes.js";
import { Link } from "./links.js";
import { Subcatchment, RainGage } from "./subcatchments.js";
/** Configured-order object handles, with case-insensitive ID lookup. */
export class ObjectCollection {
    #ids;
    #byId;
    #views = new Map();
    #create;
    #assertOpen;
    constructor(ids, create, assertOpen) {
        this.#ids = Object.freeze([...ids]);
        this.#byId = new Map(ids.map((id) => [id.toLowerCase(), id]));
        this.#create = create;
        this.#assertOpen = assertOpen;
    }
    get ids() { this.#assertOpen(); return this.#ids; }
    get size() { this.#assertOpen(); return this.#ids.length; }
    has(id) { this.#assertOpen(); return this.#byId.has(id.toLowerCase()); }
    get(id) {
        this.#assertOpen();
        const canonical = this.#byId.get(id.toLowerCase());
        if (canonical === undefined)
            throw new ObjectNotFoundError({ message: `Unknown object: ${id}`, code: 505, operation: "lookup" });
        let view = this.#views.get(canonical);
        if (view === undefined) {
            view = this.#create(canonical);
            this.#views.set(canonical, view);
        }
        return view;
    }
    at(index) {
        this.#assertOpen();
        const id = this.#ids[index];
        if (!Number.isInteger(index) || id === undefined)
            throw new RangeError(`Object index out of range: ${index}`);
        return this.get(id);
    }
    *[Symbol.iterator]() {
        this.#assertOpen();
        for (const id of this.#ids)
            yield this.get(id);
    }
}
export class NodeCollection extends ObjectCollection {
    #call;
    constructor(ids, call, assertOpen) {
        super(ids, (id) => Node.create(id, call), assertOpen);
        this.#call = call;
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new NodeCollection(ids, call, assertOpen); }
    snapshot(ids) { return this.#call("nodes", ids); }
    qualitySnapshot(ids) { return this.#call("nodeQualitySnapshot", ids); }
    statisticsSnapshot(ids) { return this.#call("nodeStatisticsSnapshot", ids); }
}
export class LinkCollection extends ObjectCollection {
    #call;
    constructor(ids, call, assertOpen) {
        super(ids, (id) => Link.create(id, call), assertOpen);
        this.#call = call;
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new LinkCollection(ids, call, assertOpen); }
    snapshot(ids) { return this.#call("links", ids); }
    qualitySnapshot(ids) { return this.#call("linkQualitySnapshot", ids); }
    statisticsSnapshot(ids) { return this.#call("linkStatisticsSnapshot", ids); }
}
export class SubcatchmentCollection extends ObjectCollection {
    #call;
    constructor(ids, call, assertOpen) {
        super(ids, (id) => Subcatchment.create(id, call), assertOpen);
        this.#call = call;
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new SubcatchmentCollection(ids, call, assertOpen); }
    snapshot(ids) { return this.#call("subcatchments", ids); }
    qualitySnapshot(ids) { return this.#call("subcatchmentQualitySnapshot", ids); }
    statisticsSnapshot(ids) { return this.#call("subcatchmentStatisticsSnapshot", ids); }
}
export class RainGageCollection extends ObjectCollection {
    constructor(ids, call, assertOpen) {
        super(ids, (id) => RainGage.create(id, call), assertOpen);
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new RainGageCollection(ids, call, assertOpen); }
}
