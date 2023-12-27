import { Validator } from "./Validator.js";
import { ValidationFail, ValidationResult, ValidationSuccess } from "./ValidationResult.js";
import type { Validation } from "./ValidatorConfiguration.js";
import type { ValidationContext } from "./ValidationContext.js";

class ComposedValidator extends Validator {
    static from(validations: Validation[]): ComposedValidator {
        const visited = new Set<Validation>()
        validations.forEach(validation => {
            const validationDefinedAfter = validation.prerequisites.find(x => !visited.has(x));
            if (validationDefinedAfter !== undefined) throw new Error(`Validation "${validationDefinedAfter.name}" is located after "${validation.name}" validation, but it is defined as a prerequisite for the validation.`)
            visited.add(validation)
        })
        return new ComposedValidator(validations);
    }

    private constructor(private readonly validations: Validation[]) { super(); }

    async validate(context: ValidationContext): Promise<ValidationResult> {
        for (const validation of this.validations) {
            const validationResult = await validation.validator.validate(context);
            if (validationResult instanceof ValidationFail) {
                return validationResult
            }
        }

        return ValidationSuccess.create()
    }
}

export function compose(...validations: Validation[]): Validator {
    return ComposedValidator.from(validations);
}