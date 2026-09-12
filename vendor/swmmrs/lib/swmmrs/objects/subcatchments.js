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
export class Subcatchment {
    id;
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
    results() { return this.#call("subcatchment", this.id); }
    lidSnapshot() { return this.#call("subcatchmentLidSnapshot", this.id); }
    configuration() { return this.#call("subcatchmentConfiguration", this.id); }
    configure(patch) { return this.#call("configureSubcatchment", this.id, patch); }
    precipitationScaleFactors() {
        return this.#call("subcatchmentPrecipitationScaleFactors", this.id);
    }
    rainScaleFactor() {
        return this.precipitationScaleFactors().then(({ rainfall }) => rainfall);
    }
    snowScaleFactor() {
        return this.precipitationScaleFactors().then(({ snowfall }) => snowfall);
    }
    setPrecipitationScaleFactors(rainfall, snowfall) {
        return this.#call("setSubcatchmentPrecipitationScaleFactors", this.id, rainfall, snowfall);
    }
    externalForcing() {
        return this.#call("subcatchmentExternalForcing", this.id);
    }
    externalRainfall() {
        return this.externalForcing().then(({ rainfall }) => rainfall);
    }
    setExternalRainfall(value) {
        return this.#call("setSubcatchmentExternalRainfall", this.id, value);
    }
    externalSnowfall() {
        return this.externalForcing().then(({ snowfall }) => snowfall);
    }
    setExternalSnowfall(value) {
        return this.#call("setSubcatchmentExternalSnowfall", this.id, value);
    }
    quality() { return this.#call("subcatchmentQuality", this.id); }
    runoffPollutantConcentration() {
        return this.quality().then((quality) => qualityMapping(quality, "runoffConcentrations"));
    }
    pondedPollutantConcentration() {
        return this.quality().then((quality) => qualityMapping(quality, "pondedConcentrations"));
    }
    pollutantBuildup() {
        return this.quality().then((quality) => qualityMapping(quality, "buildupLoads"));
    }
    pollutantTotalLoad() {
        return this.quality().then((quality) => qualityMapping(quality, "totalWashoffLoads"));
    }
    namedSettings(kind) {
        return this.#call("subcatchmentNamedSettings", this.id, kind);
    }
    namedSetting(kind, name) {
        return this.#call("subcatchmentNamedSetting", this.id, kind, name);
    }
    updateNamedSettings(kind, values, replace = false) {
        return this.#call("updateSubcatchmentNamedSettings", this.id, kind, values, replace);
    }
    clearNamedSettings(kind) {
        return this.updateNamedSettings(kind, {}, true);
    }
    initialBuildup() { return this.namedSettings("loading"); }
    updateInitialBuildup(values, replace = false) {
        return this.updateNamedSettings("loading", values, replace);
    }
    clearInitialBuildup() { return this.clearNamedSettings("loading"); }
    coverageFractions() { return this.namedSettings("coverage"); }
    updateCoverageFractions(values, replace = false) {
        return this.updateNamedSettings("coverage", values, replace);
    }
    clearCoverageFractions() { return this.clearNamedSettings("coverage"); }
    externalPollutantBuildupIncrement() {
        return this.#call("subcatchmentExternalPollutantBuildupIncrement", this.id);
    }
    externalPollutantBuildupIncrementValue(pollutantId) {
        return this.#call("subcatchmentExternalPollutantBuildupIncrementValue", this.id, pollutantId);
    }
    updateExternalPollutantBuildupIncrement(values, replace = false) {
        return this.#call("updateSubcatchmentExternalPollutantBuildupIncrement", this.id, values, replace);
    }
    clearExternalPollutantBuildupIncrement() {
        return this.updateExternalPollutantBuildupIncrement({}, true);
    }
    statistics() { return this.#call("subcatchmentStatistics", this.id); }
}
export class RainGage {
    id;
    #call;
    constructor(id, call) { this.id = id; this.#call = call; Object.freeze(this); }
    /** @internal */
    static create(id, call) { return new RainGage(id, call); }
    results() { return this.#call("rainGage", this.id); }
    totalPrecip() { return this.results().then(({ totalPrecip }) => totalPrecip); }
    rainfall() { return this.results().then(({ rainfall }) => rainfall); }
    snowfall() { return this.results().then(({ snowfall }) => snowfall); }
    externalPrecipitationRate() {
        return this.#call("rainGageExternalPrecipitationRate", this.id);
    }
    /** Select the API as the persistent source, in project rainfall units. */
    useExternalPrecipitation(rate) {
        return this.#call("useRainGageExternalPrecipitation", this.id, rate);
    }
    /** Select the API as the persistent source, in project rainfall units. */
    setPrecipitation(rate) {
        return this.#call("setRainGagePrecipitation", this.id, rate);
    }
    rainfallOverride() {
        return this.#call("rainGageRainfallOverride", this.id);
    }
    /** Override the current source. Pass null to resume the underlying source. */
    setRainfallOverride(rate) {
        return this.#call("setRainGageRainfallOverride", this.id, rate);
    }
}
