import { ObjectNotFoundError } from "../exceptions.js";
import { Node } from "./nodes.js";
import { Link } from "./links.js";
import { Subcatchment, RainGage } from "./subcatchments.js";
/**
 * Configured-order handles with synchronous, case-insensitive ID lookup and stable identity.
 * Obtain simulation collections from the owner rather than constructing a replacement view.
 * All access checks the owner lifecycle; no access is valid after close.
 * @typeParam T - Handle type returned by lookup and iteration.
 */
export class ObjectCollection {
    #ids;
    #byId;
    #views = new Map();
    #create;
    #assertOpen;
    /** Construct the shared collection implementation.
     * @param ids - Canonical IDs in configured order; copied on construction.
     * @param create - Factory called once per looked-up canonical ID.
     * @param assertOpen - Lifecycle guard called before collection access.
     */
    constructor(ids, create, assertOpen) {
        this.#ids = Object.freeze([...ids]);
        this.#byId = new Map(ids.map((id) => [id.toLowerCase(), id]));
        this.#create = create;
        this.#assertOpen = assertOpen;
    }
    /** Canonical IDs in configured order; a frozen array. */
    get ids() { this.#assertOpen(); return this.#ids; }
    /** Number of configured objects. */
    get size() { this.#assertOpen(); return this.#ids.length; }
    /** Test membership synchronously.
     * @param id - Case-insensitive object ID.
     * @returns Whether the ID is configured.
     */
    has(id) { this.#assertOpen(); return this.#byId.has(id.toLowerCase()); }
    /** Look up a stable handle synchronously.
     * @param id - Case-insensitive object ID.
     * @returns The same handle instance for repeated lookups of one canonical ID.
     * @throws ObjectNotFoundError for an unknown ID; lifecycle errors after close.
     */
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
    /** Look up a configured-order handle synchronously.
     * @param index - Zero-based integer index; negative and fractional values are invalid.
     * @returns The stable handle at the index.
     * @throws RangeError for an out-of-range or noninteger index.
     */
    at(index) {
        this.#assertOpen();
        const id = this.#ids[index];
        if (!Number.isInteger(index) || id === undefined)
            throw new RangeError(`Object index out of range: ${index}`);
        return this.get(id);
    }
    /** Iterate handles in configured order.
     * @returns Synchronous iterator, checking the owner on each lookup.
     */
    *[Symbol.iterator]() {
        this.#assertOpen();
        for (const id of this.#ids)
            yield this.get(id);
    }
}
/** Owner-bound node handles. Snapshot selections preserve requested order; omit IDs for all nodes. */
export class NodeCollection extends ObjectCollection {
    #call;
    constructor(ids, call, assertOpen) {
        super(ids, (id) => Node.create(id, call), assertOpen);
        this.#call = call;
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new NodeCollection(ids, call, assertOpen); }
    /** Read node hydraulics in `running`, `complete`, or `ended`.
     * @param ids - Ordered selection; omit for all, use [] for empty columns. Unknown or case-insensitive duplicate IDs reject.
     * @returns Detached columns aligned with canonical `objectIds`, without a timestamp.
     */
    snapshot(ids) { return this.#call("nodes", ids); }
    /** Read node quality in `running`, `complete`, or `ended`.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject.
     * @returns Detached pollutant-major matrices; inner rows follow `objectIds`.
     */
    qualitySnapshot(ids) { return this.#call("nodeQualitySnapshot", ids); }
    /** Read cumulative node statistics in `running` or `complete`, before ending the run.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject.
     * @returns Detached statistics columns aligned with canonical `objectIds`.
     */
    statisticsSnapshot(ids) { return this.#call("nodeStatisticsSnapshot", ids); }
}
/** Owner-bound link handles. Snapshot selections preserve requested order; omit IDs for all links. */
export class LinkCollection extends ObjectCollection {
    #call;
    constructor(ids, call, assertOpen) {
        super(ids, (id) => Link.create(id, call), assertOpen);
        this.#call = call;
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new LinkCollection(ids, call, assertOpen); }
    /** Read link hydraulics in `running`, `complete`, or `ended`.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject, including case-only duplicates.
     * @returns Detached hydraulic columns aligned with canonical `objectIds`, without a timestamp.
     */
    snapshot(ids) { return this.#call("links", ids); }
    /** Read link quality in `running`, `complete`, or `ended`.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject.
     * @returns Detached pollutant-major matrices; inner rows follow `objectIds`.
     */
    qualitySnapshot(ids) { return this.#call("linkQualitySnapshot", ids); }
    /** Read cumulative link statistics in `running` or `complete`.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject.
     * @returns Detached scalar columns; flow-class durations have one seven-value row per link.
     */
    statisticsSnapshot(ids) { return this.#call("linkStatisticsSnapshot", ids); }
}
/** Owner-bound subcatchment handles and aligned hydraulic, quality, and statistics reads. */
export class SubcatchmentCollection extends ObjectCollection {
    #call;
    constructor(ids, call, assertOpen) {
        super(ids, (id) => Subcatchment.create(id, call), assertOpen);
        this.#call = call;
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new SubcatchmentCollection(ids, call, assertOpen); }
    /** Read runoff results in `running`, `complete`, or `ended`.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject, including case-only duplicates.
     * @returns Detached runoff columns aligned with canonical `objectIds`, without a timestamp.
     */
    snapshot(ids) { return this.#call("subcatchments", ids); }
    /** Read subcatchment quality in `running`, `complete`, or `ended`.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject.
     * @returns Detached pollutant-major matrices; inner rows follow `objectIds`.
     */
    qualitySnapshot(ids) { return this.#call("subcatchmentQualitySnapshot", ids); }
    /** Read cumulative runoff statistics in `running` or `complete`.
     * @param ids - Ordered IDs; omit for all or use [] for none. Unknown/duplicate IDs reject.
     * @returns Detached statistics columns aligned with canonical `objectIds`.
     */
    statisticsSnapshot(ids) { return this.#call("subcatchmentStatisticsSnapshot", ids); }
}
/** Owner-bound rain-gage handles. Rain gages provide per-object results, not collection snapshots. */
export class RainGageCollection extends ObjectCollection {
    constructor(ids, call, assertOpen) {
        super(ids, (id) => RainGage.create(id, call), assertOpen);
    }
    /** @internal */
    static create(ids, call, assertOpen) { return new RainGageCollection(ids, call, assertOpen); }
}
