export class SwmmError extends Error {
    code;
    operation;
    detail;
    /** Preserves unknown future categories rather than discarding them. */
    semanticCode;
    category;
    report;
    cleanupError;
    constructor(details) {
        super(details.message);
        this.name = new.target.name;
        this.code = details.code;
        this.operation = details.operation;
        this.detail = details.detail;
        this.semanticCode = details.semanticCode;
        this.category = details.category;
        this.report = details.report;
        this.cleanupError = details.cleanupError;
    }
}
export class SolverError extends SwmmError {
}
export class LifecycleError extends SwmmError {
}
export class StaleViewError extends LifecycleError {
}
export class ValidationError extends SwmmError {
}
export class ConfigurationError extends ValidationError {
    diagnostics;
    constructor(details) {
        super(details);
        this.diagnostics = Object.freeze((details.diagnostics ?? []).map(diagnostic => Object.freeze({
            ...diagnostic,
            object: Object.freeze({ ...diagnostic.object }),
            conflictingObject: diagnostic.conflictingObject === null ? null : Object.freeze({ ...diagnostic.conflictingObject }),
        })));
    }
}
export class ObjectNotFoundError extends SwmmError {
}
export class WorkerError extends SwmmError {
}
export class InternalSimulationError extends WorkerError {
}
/** @internal */
export function fromWorkerError(details) {
    if (details.diagnostics !== undefined)
        return new ConfigurationError(details);
    if ([501, 502, 503, 2001, 2002, 2013].includes(details.code ?? -1))
        return new LifecycleError(details);
    if ([505, 506, 2000, 2004, 2005, 2007, 2008, 2009].includes(details.code ?? -1))
        return new ObjectNotFoundError(details);
    if ([504, 507, 508, 509, 2003, 2006, 2010, 2012].includes(details.code ?? -1))
        return new ValidationError(details);
    if (details.code === 9999)
        return new InternalSimulationError(details);
    return new SolverError(details);
}
