import { WorkerClient } from "./client.js";
import { LifecycleError } from "./exceptions.js";
import { bytes, createWorker } from "./runtime.js";
const EMPTY_TIMES = [];
export class OutputName {
    #bytes;
    text;
    constructor(raw) {
        this.#bytes = new Uint8Array(raw);
        this.text = decodeName(this.#bytes);
        Object.freeze(this);
    }
    /** Return a defensive copy of the exact stored name bytes. */
    get raw() { return this.#bytes.slice(); }
}
/** Fixed report schedule and available complete-period count. */
export class ReportTiming {
    reportScheduleOrigin;
    reportStepSeconds;
    periodCount;
    constructor(reportScheduleOrigin, reportStepSeconds, periodCount) {
        this.reportScheduleOrigin = reportScheduleOrigin;
        this.reportStepSeconds = reportStepSeconds;
        this.periodCount = periodCount;
        Object.freeze(this);
    }
    /** Return the rounded timezone-free nominal date for a report period. */
    nominalDate(period) {
        if (!Number.isInteger(period))
            throw new TypeError("period must be an integer");
        if (period < 0 || period >= this.periodCount)
            return null;
        return modelTimeFromSerial(this.reportScheduleOrigin + (period + 1) * this.reportStepSeconds / 86_400);
    }
}
/** Immutable column-oriented result for an ordered bulk request. */
export class BulkSeriesResult {
    times;
    series;
    constructor(times, series) {
        this.times = freezeArray(times);
        this.series = freezeArray(series);
        Object.freeze(this);
    }
    /** Return one value using offsets local to this result. */
    value(periodOffset, selectionOffset) {
        if (!Number.isInteger(periodOffset) || periodOffset < 0 || periodOffset >= this.times.length) {
            throw new RangeError("period offset is outside this result");
        }
        if (!Number.isInteger(selectionOffset) || selectionOffset < 0 || selectionOffset >= this.series.length) {
            throw new RangeError("selection offset is outside this result");
        }
        return this.series[selectionOffset].values[periodOffset];
    }
}
/** Structured output-reader failure preserved across the worker boundary. */
export class OutputError extends Error {
    category;
    operation;
    constructor(category, message, operation) {
        super(message);
        this.name = "OutputError";
        this.category = category;
        this.operation = operation;
    }
}
/** One isolated browser worker and byte-owned standalone output reader. */
export class OutputReader {
    metadata;
    #client;
    #times;
    #closing;
    #closed = false;
    constructor(client, metadata) {
        this.#client = client;
        this.metadata = metadata;
        Object.freeze(this);
    }
    /** Open one finalized or incomplete SWMM output from file contents, never a host path. */
    static async open(input, options = {}) {
        const worker = await createWorker(options);
        const client = new WorkerClient(worker);
        const call = client.call;
        try {
            const payload = await call("openOutput", await bytes(input));
            return new OutputReader(client, metadataFromPayload(payload));
        }
        catch (error) {
            client.stop(error instanceof Error ? error : new Error(String(error)));
            throw outputFailure(error, "openOutput");
        }
    }
    /** True when the opened bytes contained a valid finalized trailer. */
    get isFinalized() { return this.metadata.runStatus.isFinalized; }
    /** Lazily derive the shared nominal report-date axis from validated metadata. */
    get times() {
        if (this.#times === undefined) {
            const values = Array.from({ length: this.metadata.reportTiming.periodCount }, (_, period) => this.metadata.reportTiming.nominalDate(period));
            this.#times = freezeArray(values);
        }
        return this.#times;
    }
    /** Read ordered selections, preserving duplicate columns and empty dimensions. */
    readBulkSeries(selections, options = {}) {
        const [start, end] = this.#resolveBounds(options);
        const nativeSelections = selections.map((selection) => this.#nativeSelection(selection));
        const method = options.lowMemory === true ? "outputReadBulkSeries" : "outputReadBulkSeriesByPeriod";
        return this.#call(method, nativeSelections, start, end).then((payload) => bulkFromPayload(payload, this.metadata));
    }
    /** Read one subcatchment series by index or exact stored name. */
    subcatchmentSeries(element, attribute, options = {}) {
        return this.#singleSeries({ elementType: "subcatchment", element, attribute }, options);
    }
    /** Read one node series by index or exact stored name. */
    nodeSeries(element, attribute, options = {}) {
        return this.#singleSeries({ elementType: "node", element, attribute }, options);
    }
    /** Read one link series by index or exact stored name. */
    linkSeries(element, attribute, options = {}) {
        return this.#singleSeries({ elementType: "link", element, attribute }, options);
    }
    /** Read one system series without a synthetic element identity. */
    systemSeries(attribute, options = {}) {
        return this.#singleSeries({ elementType: "system", element: null, attribute }, options);
    }
    /** Read exact Stored Report Date serial-day values over a resolved range. */
    readStoredDates(options = {}) {
        const [start, end] = this.#resolveBounds(options);
        return this.#call("outputReadStoredDates", start, end).then((values) => freezeArray(values));
    }
    /** Release the reader worker. Repeated calls share one cleanup request. */
    async close() {
        if (this.#closing !== undefined)
            return this.#closing;
        this.#closing = this.#call("closeOutput").finally(() => {
            this.#closed = true;
            this.#client.stop(new LifecycleError({ message: "Output reader is closed", operation: "closeOutput" }));
        });
        return this.#closing;
    }
    [Symbol.asyncDispose]() { return this.close(); }
    #singleSeries(selection, options) {
        return this.readBulkSeries([selection], options).then((result) => {
            const series = result.series[0];
            if (series === undefined)
                throw new OutputError("output", "native output returned no series");
            return Object.freeze({ selection: series.selection, times: result.times, values: series.values });
        });
    }
    #nativeSelection(selection) {
        if (selection.elementType === "system") {
            if (selection.element !== null)
                throw new TypeError("system selections do not carry an element");
            return ["system", 0, attributeCode(this.metadata, selection.elementType, selection.attribute)];
        }
        if (selection.element === null)
            throw new TypeError("non-system selections require an element");
        return [
            selection.elementType,
            resolveElement(this.metadata, selection.elementType, selection.element),
            attributeCode(this.metadata, selection.elementType, selection.attribute),
        ];
    }
    #resolveBounds(options) {
        if (options === null || typeof options !== "object")
            throw new TypeError("options must be an object");
        if (options.lowMemory !== undefined && typeof options.lowMemory !== "boolean") {
            throw new TypeError("lowMemory must be a boolean");
        }
        const count = this.metadata.reportTiming.periodCount;
        const needsAxis = isModelTime(options.start) || isModelTime(options.end);
        const axis = needsAxis ? this.times : EMPTY_TIMES;
        const start = resolveBound(options.start, 0, count, axis);
        const end = resolveBound(options.end, count, count, axis);
        if (isModelTime(options.start) && isModelTime(options.end) && options.start > options.end) {
            throw new OutputError("invalid_period_range", "start bound must not be later than end bound");
        }
        if (start > end)
            throw new OutputError("invalid_period_range", "resolved period range is inverted");
        return [start, end];
    }
    #call(method, ...args) {
        if (this.#closed)
            return Promise.reject(new LifecycleError({ message: "Output reader is closed", operation: String(method) }));
        const call = this.#client.call;
        return call(method, ...args).catch((error) => { throw outputFailure(error, String(method)); });
    }
}
function metadataFromPayload(payload) {
    const timing = new ReportTiming(payload.reportTiming.reportScheduleOrigin, payload.reportTiming.reportStepSeconds, payload.reportTiming.periodCount);
    const metadata = {
        solverRelease: payload.solverRelease,
        runStatus: Object.freeze({
            code: payload.runStatus.code,
            isFinalized: payload.runStatus.code !== null,
            isSuccess: payload.runStatus.code === 0,
        }),
        flowUnits: category(payload.flowUnits),
        unitSystem: payload.unitSystem,
        reportTiming: timing,
        subcatchments: freezeArray(payload.subcatchments.map((item) => Object.freeze({ index: item.index, name: nameFromPayload(item.name), area: item.area }))),
        nodes: freezeArray(payload.nodes.map((item) => Object.freeze({ index: item.index, name: nameFromPayload(item.name), kind: category(item.kind), invertElevation: item.invertElevation, maximumDepth: item.maximumDepth }))),
        links: freezeArray(payload.links.map((item) => Object.freeze({ index: item.index, name: nameFromPayload(item.name), kind: category(item.kind), inletOffset: item.inletOffset, outletOffset: item.outletOffset, maximumDepth: item.maximumDepth, length: item.length }))),
        pollutants: freezeArray(payload.pollutants.map((item) => Object.freeze({ index: item.index, name: nameFromPayload(item.name), concentrationUnits: category(item.concentrationUnits) }))),
        resultSchema: Object.freeze({
            subcatchment: freezeArray(payload.resultSchema.subcatchment.map((item) => attributeFromPayload(item, "subcatchment"))),
            node: freezeArray(payload.resultSchema.node.map((item) => attributeFromPayload(item, "node"))),
            link: freezeArray(payload.resultSchema.link.map((item) => attributeFromPayload(item, "link"))),
            system: freezeArray(payload.resultSchema.system.map((item) => attributeFromPayload(item, "system"))),
        }),
    };
    return Object.freeze(metadata);
}
function bulkFromPayload(payload, metadata) {
    const times = freezeArray(payload.times.map(modelTimeFromSerial));
    const series = payload.series.map((item) => Object.freeze({
        selection: selectionFromPayload(item.selection, metadata),
        values: freezeArray(item.values),
    }));
    return new BulkSeriesResult(times, series);
}
function selectionFromPayload(payload, metadata) {
    const elementType = payload.elementType;
    const attribute = attributeFromPayload(payload.attribute, elementType);
    return Object.freeze({ elementType, element: elementType === "system" ? null : payload.element, attribute });
}
function attributeFromPayload(value, _family) {
    const attribute = typeof value === "string" ? value
        : Object.freeze("pollutant" in value ? { selector: value.pollutant } : { code: value.code });
    return attribute;
}
function attributeCode(metadata, family, attribute) {
    if (typeof attribute === "string") {
        const known = knownAttributeCode(family, attribute);
        if (known === undefined)
            throw new TypeError(`unknown ${family} attribute ${attribute}`);
        return known;
    }
    if ("selector" in attribute) {
        const pollutant = resolvePollutant(metadata, attribute.selector);
        const schema = schemaFor(metadata, family);
        const entry = schema.find((candidate) => typeof candidate === "object" && candidate !== null && "selector" in candidate && candidate.selector === pollutant);
        if (entry === undefined)
            throw new OutputError("attribute_not_found", `pollutant ${pollutant} is absent from ${family} schema`);
        return pollutantCode(family, pollutant);
    }
    if (!Number.isInteger(attribute.code) || attribute.code < -2_147_483_648 || attribute.code > 2_147_483_647) {
        throw new RangeError("result code must fit a signed 32-bit integer");
    }
    return attribute.code;
}
function knownAttributeCode(family, attribute) {
    const known = {
        subcatchment: ["rainfall", "snow_depth", "evap_loss", "infil_loss", "runoff_rate", "gw_outflow_rate", "gw_table_elev", "soil_moisture"],
        node: ["invert_depth", "hydraulic_head", "ponded_volume", "lateral_inflow", "total_inflow", "flooding_losses"],
        link: ["flow_rate", "flow_depth", "flow_velocity", "flow_volume", "capacity"],
        system: ["air_temp", "rainfall", "snow_depth", "evap_infil_loss", "runoff_flow", "dry_weather_inflow", "gw_inflow", "rdii_inflow", "direct_inflow", "total_lateral_inflow", "flood_losses", "outfall_flows", "volume_stored", "evap_rate", "ptnl_evap_rate"],
    };
    const index = known[family].indexOf(attribute);
    return index < 0 ? undefined : index;
}
function pollutantCode(family, index) {
    const offset = family === "subcatchment" ? 8 : family === "node" ? 6 : 5;
    if (family === "system")
        throw new TypeError("system selections do not support pollutants");
    const code = offset + index;
    if (code > 2_147_483_647)
        throw new RangeError("pollutant result code does not fit a signed 32-bit integer");
    return code;
}
function resolveElement(metadata, family, selector) {
    if (typeof selector === "number") {
        if (!Number.isInteger(selector) || selector < 0)
            throw new RangeError("element index must be a nonnegative integer");
        const count = family === "subcatchment" ? metadata.subcatchments.length : family === "node" ? metadata.nodes.length : metadata.links.length;
        if (selector >= count)
            throw new OutputError("invalid_element_id", `invalid ${family} element index ${selector}`);
        return selector;
    }
    const raw = selector instanceof OutputName ? selector.raw : typeof selector === "string" ? new TextEncoder().encode(selector) : selector;
    const records = family === "subcatchment" ? metadata.subcatchments : family === "node" ? metadata.nodes : metadata.links;
    let found = -1;
    let count = 0;
    for (const [index, record] of records.entries()) {
        if (bytesEqual(record.name.raw, raw)) {
            found = index;
            count += 1;
        }
    }
    if (count === 0)
        throw new OutputError("element_not_found", `${family} element name was not found`);
    if (count > 1)
        throw new OutputError("ambiguous_element", `${family} element name matched ${count} elements`);
    return found;
}
function resolvePollutant(metadata, selector) {
    if (typeof selector === "number") {
        if (!Number.isInteger(selector) || selector < 0 || selector >= metadata.pollutants.length)
            throw new OutputError("pollutant_not_found", `pollutant index ${selector} was not found`);
        return selector;
    }
    const raw = selector instanceof OutputName ? selector.raw : typeof selector === "string" ? new TextEncoder().encode(selector) : selector;
    let found = -1;
    let count = 0;
    for (const [index, pollutant] of metadata.pollutants.entries()) {
        if (bytesEqual(pollutant.name.raw, raw)) {
            found = index;
            count += 1;
        }
    }
    if (count === 0)
        throw new OutputError("pollutant_not_found", "pollutant name was not found");
    if (count > 1)
        throw new OutputError("ambiguous_pollutant", `pollutant name matched ${count} pollutants`);
    return found;
}
function schemaFor(metadata, family) {
    return metadata.resultSchema[family];
}
function resolveBound(bound, fallback, count, axis) {
    if (bound === undefined || bound === null)
        return fallback;
    if (typeof bound === "number") {
        if (!Number.isInteger(bound))
            throw new TypeError("period bounds must be integers or ModelTime strings");
        if (bound < 0 || bound > count)
            throw new RangeError("period bound is outside the available range");
        return bound;
    }
    if (!isModelTime(bound))
        throw new TypeError("date bounds must be timezone-free ModelTime strings");
    let low = 0;
    let high = axis.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (axis[middle] < bound)
            low = middle + 1;
        else
            high = middle;
    }
    return low;
}
function isModelTime(value) {
    if (typeof value !== "string")
        return false;
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})$/.exec(value);
    if (match === null)
        return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    if (year < 1 || year > 9999 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59)
        return false;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day
        && date.getUTCHours() === hour
        && date.getUTCMinutes() === minute
        && date.getUTCSeconds() === second;
}
function modelTimeFromSerial(serial) {
    const totalSeconds = serial * 86_400;
    if (!Number.isFinite(totalSeconds))
        throw new OutputError("datetime_out_of_range", "nominal report date is outside the supported time range");
    const rounded = roundHalfEven(totalSeconds);
    const unixSeconds = rounded - 2_209_161_600;
    if (unixSeconds < -62_135_596_800 || unixSeconds > 253_402_300_799) {
        throw new OutputError("datetime_out_of_range", "nominal report date is outside the supported time range");
    }
    const date = new Date(unixSeconds * 1_000);
    if (!Number.isFinite(date.getTime()))
        throw new OutputError("datetime_out_of_range", "nominal report date is outside the supported time range");
    return date.toISOString().slice(0, 19);
}
function roundHalfEven(value) {
    const lower = Math.floor(value);
    const fraction = value - lower;
    if (fraction < 0.5)
        return lower;
    if (fraction > 0.5)
        return lower + 1;
    return lower % 2 === 0 ? lower : lower + 1;
}
function decodeName(raw) {
    try {
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
    }
    catch {
        return null;
    }
}
function nameFromPayload(value) {
    return new OutputName(value.raw);
}
function category(value) {
    return typeof value === "string" ? value : Object.freeze({ code: value.code });
}
function bytesEqual(left, right) {
    if (left.length !== right.length)
        return false;
    for (let index = 0; index < left.length; index += 1)
        if (left[index] !== right[index])
            return false;
    return true;
}
function freezeArray(values) {
    return Object.freeze(Array.from(values));
}
function outputFailure(error, operation) {
    if (error instanceof OutputError)
        return error;
    const source = error;
    if (source && typeof source.category === "string") {
        return new OutputError(source.category, typeof source.message === "string" ? source.message : String(error), typeof source.operation === "string" ? source.operation : operation);
    }
    return error instanceof Error ? error : new Error(String(error));
}
