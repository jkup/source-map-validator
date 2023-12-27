import type { Validator } from "./Validator.js";

export type ValidatorConfiguration = {
    readonly validator: new () => Validator,
    readonly name: string,
    readonly description: string,
    readonly prerequisites?: Validation[]
};

export type Validation = {
    readonly name: string,
    readonly validator: Validator,
    readonly prerequisites: Validation[]
};

export function validation(configuration: ValidatorConfiguration): Validation {
    return {
        name: configuration.name,
        validator: new configuration.validator(),
        prerequisites: configuration.prerequisites ?? []
    };
}