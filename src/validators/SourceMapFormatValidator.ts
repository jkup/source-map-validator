import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import type { ValidationContext } from "../util/ValidationContext.js";

export class SourceMapFormatValidator extends Validator {
  validate({ sourceMap }: ValidationContext): ValidationResult {
    const errors: Error[] = [];

    if (sourceMap.version !== 3) {
      errors.push(new Error("Source map version is not 3."));
    }

    if (!sourceMap.sources || !Array.isArray(sourceMap.sources)) {
      errors.push(new Error('Source map "sources" field is invalid or missing.'));
    } else {
      sourceMap.sources.forEach((x: unknown, i: number) => {
        if (typeof x !== "string") errors.push(new Error(`There is a source with an invalid format on the index ${i}. Each source should be defined as a string`))
      })
    }

    if (!sourceMap.mappings) {
      errors.push(new Error('Source map "mappings" field is missing.'));
    }

    if ('sourcesContent' in sourceMap) {
      if (!Array.isArray(sourceMap.sourcesContent))
        errors.push(new Error('Source map "sources" field is invalid.'));
      sourceMap.sourcesContent.forEach((x: unknown, i: number) => {
        if (x !== null && typeof x !== "string") errors.push(new Error(`There is a source content with an invalid format on the index ${i}. Each content should be defined as a strings or null`))
      })
    }

    return ValidationResult.from(errors);
  }
}
