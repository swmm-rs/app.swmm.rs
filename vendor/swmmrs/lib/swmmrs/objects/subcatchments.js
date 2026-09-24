import { LidUnitCollection } from "./lids.js";
function qualityMapping(quality, field) {
    const values = {};
    for (const [index, pollutantId] of quality.pollutantIds.entries()) {
        const value = quality[field][index];
        if (value !== undefined)
            values[pollutantId] = value;
    }
    return values;
}
/** Subcatchment handle owned by one Simulation. Worker reads return detached values; use `configure` only in `open` or `ended`. */
export class Subcatchment {
    /** Canonical configured subcatchment ID. */
    id;
    /** Asynchronously indexed LID usages belonging to this subcatchment. */
    lidUnits;
    #call;
    constructor(id, call) {
        this.id = id;
        this.#call = call;
        this.lidUnits = LidUnitCollection.create(id, call);
        Object.freeze(this);
    }
    /** @internal */
    static create(id, call) { return new Subcatchment(id, call); }
    /** Read current runoff results in `running`, `complete`, or `ended`.
     * @returns Detached result record in project units.
     */
    results() { return this.#call("subcatchment", this.id); }
    /** Read aggregate LID-group results in `running` or `complete`, before `end()`.
     * @returns Detached aggregate LID results.
     * @throws A solver error when this subcatchment has no LID group.
     */
    lidSnapshot() { return this.#call("subcatchmentLidSnapshot", this.id); }
    /** Read declarations in any healthy owner state.
     * @returns Detached configuration with canonical relationship IDs.
     */
    configuration() { return this.#call("subcatchmentConfiguration", this.id); }
    /** Atomically update declarations in `open` or `ended`; preparation-sensitive edits return the owner to `open`.
     * @param patch - Sparse project-unit declarations. Null removes optional relationships; supplied buildup/coverage maps replace those complete maps.
     * @returns Resolves after all supplied fields are accepted; rejected patches apply no fields.
     */
    configure(patch) { return this.#call("configureSubcatchment", this.id, patch); }
    /** Read persistent precipitation multipliers in a healthy owner state.
     * @returns Dimensionless rainfall and snowfall factors.
     */
    precipitationScaleFactors() {
        return this.#call("subcatchmentPrecipitationScaleFactors", this.id);
    }
    /** Read the persistent dimensionless rainfall multiplier; initially 1. */
    rainScaleFactor() {
        return this.precipitationScaleFactors().then(({ rainfall }) => rainfall);
    }
    /** Read the persistent dimensionless snowfall multiplier; initially 1. */
    snowScaleFactor() {
        return this.precipitationScaleFactors().then(({ snowfall }) => snowfall);
    }
    /** Replace persistent precipitation multipliers in `open`, `running`, or `ended`.
     * @param rainfall - Finite nonnegative rainfall multiplier.
     * @param snowfall - Finite nonnegative snowfall multiplier.
     * @returns Resolves after both values are accepted; values persist until replaced.
     */
    setPrecipitationScaleFactors(rainfall, snowfall) {
        return this.#call("setSubcatchmentPrecipitationScaleFactors", this.id, rainfall, snowfall);
    }
    /** Read persistent external rainfall/snowfall additions in a healthy owner state.
     * @returns Rates in in/h or mm/h, initially zero.
     */
    externalForcing() {
        return this.#call("subcatchmentExternalForcing", this.id);
    }
    /** Read the persistent external rainfall addition in in/h or mm/h. */
    externalRainfall() {
        return this.externalForcing().then(({ rainfall }) => rainfall);
    }
    /** Replace the persistent rainfall addition in `open`, `running`, or `ended`.
     * @param value - Finite nonnegative rate in in/h or mm/h; zero clears the addition.
     */
    setExternalRainfall(value) {
        return this.#call("setSubcatchmentExternalRainfall", this.id, value);
    }
    /** Read the persistent external snowfall addition in in/h or mm/h. */
    externalSnowfall() {
        return this.externalForcing().then(({ snowfall }) => snowfall);
    }
    /** Replace the persistent snowfall addition in `open`, `running`, or `ended`.
     * @param value - Finite nonnegative rate in in/h or mm/h; zero clears the addition.
     */
    setExternalSnowfall(value) {
        return this.#call("setSubcatchmentExternalSnowfall", this.id, value);
    }
    /** Read pollutant-aligned quality results in `running`, `complete`, or `ended`.
     * @returns Detached concentrations and loads in configured pollutant units.
     */
    quality() { return this.#call("subcatchmentQuality", this.id); }
    /** Read runoff concentrations keyed by pollutant ID in `running`, `complete`, or `ended`; values use configured concentration units. */
    runoffPollutantConcentration() {
        return this.quality().then((quality) => qualityMapping(quality, "runoffConcentrations"));
    }
    /** Read ponded-water concentrations keyed by pollutant ID in `running`, `complete`, or `ended`; values use configured concentration units. */
    pondedPollutantConcentration() {
        return this.quality().then((quality) => qualityMapping(quality, "pondedConcentrations"));
    }
    /** Read current buildup keyed by pollutant ID in `running`, `complete`, or `ended`; values use configured pollutant load units. */
    pollutantBuildup() {
        return this.quality().then((quality) => qualityMapping(quality, "buildupLoads"));
    }
    /** Read cumulative washoff keyed by pollutant ID in `running`, `complete`, or `ended`; values use configured pollutant load units. */
    pollutantTotalLoad() {
        return this.quality().then((quality) => qualityMapping(quality, "totalWashoffLoads"));
    }
    /** Read configured loading or coverage in a healthy owner state.
     * @param kind - `loading` for pollutant buildup; `coverage` for land-use fractions.
     * @returns Detached canonical-ID map in pollutant load units or area fractions, respectively.
     */
    namedSettings(kind) {
        return this.#call("subcatchmentNamedSettings", this.id, kind);
    }
    /** Read one named declaration in a healthy owner state.
     * @param kind - Loading or coverage selector.
     * @param name - Configured pollutant ID or land-use ID, respectively.
     * @returns Initial load or coverage fraction for the selected definition.
     */
    namedSetting(kind, name) {
        return this.#call("subcatchmentNamedSetting", this.id, kind, name);
    }
    /** Atomically update loading or coverage in `open` or `ended`; accepted declaration edits return the owner to `open`.
     * @param kind - Loading or coverage selector.
     * @param values - Configured pollutant-ID/load or land-use-ID/fraction map.
     * @param replace - False by default merges supplied entries; true clears omitted entries to zero.
     * @returns Resolves after the update is accepted.
     */
    updateNamedSettings(kind, values, replace = false) {
        return this.#call("updateSubcatchmentNamedSettings", this.id, kind, values, replace);
    }
    /** Clear every entry in one named declaration family in `open` or `ended`.
     * @param kind - Loading or coverage selector.
     */
    clearNamedSettings(kind) {
        return this.updateNamedSettings(kind, {}, true);
    }
    /** Read configured initial buildup by pollutant ID in a healthy owner state; values use pollutant load units. */
    initialBuildup() { return this.namedSettings("loading"); }
    /** Update configured initial buildup in `open` or `ended`.
     * @param values - Canonical pollutant-ID map in configured load units.
     * @param replace - False by default merges; true clears omitted pollutants to zero.
     */
    updateInitialBuildup(values, replace = false) {
        return this.updateNamedSettings("loading", values, replace);
    }
    /** Clear configured initial buildup in `open` or `ended`. */
    clearInitialBuildup() { return this.clearNamedSettings("loading"); }
    /** Read configured land-use area fractions by ID in a healthy owner state. */
    coverageFractions() { return this.namedSettings("coverage"); }
    /** Update land-use coverage in `open` or `ended`.
     * @param values - Canonical land-use-ID map of area fractions, not percentages.
     * @param replace - False by default merges; true clears omitted land uses to zero.
     */
    updateCoverageFractions(values, replace = false) {
        return this.updateNamedSettings("coverage", values, replace);
    }
    /** Clear all land-use coverage declarations in `open` or `ended`. */
    clearCoverageFractions() { return this.clearNamedSettings("coverage"); }
    /** Read persistent external buildup increments in `open`, `running`, or `ended`; values are loads applied on runoff updates, not concentrations. */
    externalPollutantBuildupIncrement() {
        return this.#call("subcatchmentExternalPollutantBuildupIncrement", this.id);
    }
    /** Read one persistent buildup increment in `open`, `running`, or `ended`.
     * @param pollutantId - Configured pollutant ID.
     * @returns External increment in that pollutant's load units.
     */
    externalPollutantBuildupIncrementValue(pollutantId) {
        return this.#call("subcatchmentExternalPollutantBuildupIncrementValue", this.id, pollutantId);
    }
    /** Update persistent buildup increments in `open`, `running`, or `ended`.
     * @param values - Configured pollutant-ID map of finite nonnegative increments in pollutant load units.
     * @param replace - False by default merges; true clears omitted pollutants to zero.
     * @returns Resolves after the update; increments persist until explicitly replaced or cleared.
     */
    updateExternalPollutantBuildupIncrement(values, replace = false) {
        return this.#call("updateSubcatchmentExternalPollutantBuildupIncrement", this.id, values, replace);
    }
    /** Clear all persistent buildup increments in `open`, `running`, or `ended`. */
    clearExternalPollutantBuildupIncrement() {
        return this.updateExternalPollutantBuildupIncrement({}, true);
    }
    /** Read cumulative statistics in `running` or `complete`, before `end()`.
     * @returns Detached runoff statistics in project units.
     */
    statistics() { return this.#call("subcatchmentStatistics", this.id); }
}
/** Rain-gage handle owned by one Simulation; source selection and temporary overrides are distinct persistent inputs. */
export class RainGage {
    /** Canonical configured rain-gage ID. */
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new RainGage(id, call); }
    /** Read current precipitation in `running`, `complete`, or `ended`.
     * @returns Detached rainfall, snowfall, and total rates in in/h or mm/h.
     */
    results() { return this.#call("rainGage", this.id); }
    /** Read total precipitation rate, not accumulated depth, in in/h or mm/h; requires `running`, `complete`, or `ended`. */
    totalPrecip() { return this.results().then(({ totalPrecip }) => totalPrecip); }
    /** Read liquid rainfall rate in in/h or mm/h; requires `running`, `complete`, or `ended`. */
    rainfall() { return this.results().then(({ rainfall }) => rainfall); }
    /** Read snowfall water-equivalent rate in in/h or mm/h; requires `running`, `complete`, or `ended`. */
    snowfall() { return this.results().then(({ snowfall }) => snowfall); }
    /** Read the selected API source rate in a healthy owner state.
     * @returns Rate in in/h or mm/h, or null when the API is not the underlying source.
     */
    externalPrecipitationRate() {
        return this.#call("rainGageExternalPrecipitationRate", this.id);
    }
    /** Select the API as the persistent precipitation source in `open`, `running`, or `ended`.
     * @param rate - Finite nonnegative rate in in/h or mm/h; zero selects a dry API source, not the original source.
     * @returns Resolves after source selection; the value persists until replaced.
     */
    useExternalPrecipitation(rate) {
        return this.#call("useRainGageExternalPrecipitation", this.id, rate);
    }
    /** Alias for selecting the persistent API precipitation source in `open`, `running`, or `ended`.
     * @param rate - Finite nonnegative rate in in/h or mm/h; this is not a temporary override.
     */
    setPrecipitation(rate) {
        return this.#call("setRainGagePrecipitation", this.id, rate);
    }
    /** Read the temporary source override in a healthy owner state.
     * @returns Rate in in/h or mm/h, or null when no override is active.
     */
    rainfallOverride() {
        return this.#call("rainGageRainfallOverride", this.id);
    }
    /** Override the current source in `open`, `running`, or `ended` without changing source selection.
     * @param rate - Finite nonnegative rate in in/h or mm/h; null clears the override and resumes the selected underlying source.
     * @returns Resolves after the update; an override remains active until changed or cleared.
     */
    setRainfallOverride(rate) {
        return this.#call("setRainGageRainfallOverride", this.id, rate);
    }
}
