import fs from "fs";
import path from "path";
import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import type { ValidationContext } from "../util/ValidationContext.js";

export class SourceFilesValidator extends Validator {
  validate(context: ValidationContext): ValidationResult {
    const errors: Error[] = [];
    const { sources, sourcesContent = [] } = context.sourceMap

    sources.forEach((sourceFileName: string, index: number) => {
      const fullPath = path.join(context.originalFolderPath, sourceFileName);
      if (!fs.existsSync(fullPath) && sourcesContent[index] == undefined) {
        errors.push(new Error(`Source file not found: ${sourceFileName}`));
      }
    });

    return ValidationResult.from(errors)
  }
}