import fs from "fs";
import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import type { ValidationContext } from "../util/ValidationContext.js";

export class SourceMapJSONValidator extends Validator {
  validate(context: ValidationContext): ValidationResult {
    const errors: Error[] = [];

    try {
      // Check if file exists and can be read
      fs.accessSync(context.sourceMapPath, fs.constants.R_OK);
      // Read file contents
      const sourceMapContent = fs.readFileSync(context.sourceMapPath, "utf8");
      // Parse JSON
      context.sourceMap = JSON.parse(sourceMapContent);
    } catch (e: any) {
      errors.push(e.message)
    }

    return ValidationResult.from(errors);
  }
}
