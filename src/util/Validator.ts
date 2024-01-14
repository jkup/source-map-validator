import type { ValidationResult } from "./ValidationResult.js";
import type { ValidationContext } from "./ValidationContext.js";

export abstract class Validator {
    abstract validate(context: ValidationContext): ValidationResult | Promise<ValidationResult>
}
