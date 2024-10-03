import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import type { ValidationContext } from "../util/ValidationContext.js";

// Defined separately from the validator class below in order to enable easier
// recursive calls.
function validateSourceMap(sourceMap : any) : Error[] {
  const errors: Error[] = [];

  if (sourceMap.version !== 3) {
    errors.push(new Error(`Source map version is not 3, got ${sourceMap.version}.`));
  }

  if ('file' in sourceMap) {
    if (typeof sourceMap.file !== "string")
      errors.push(new Error('Source map "file" field is not a string.'));
  }

  if ("sections" in sourceMap) {
    if ("mappings" in sourceMap) {
      errors.push(new Error('Source map cannot have both "mappings" and "sections" fields.'));
    }

    if (typeof sourceMap.sections !== "object") {
      errors.push(new Error('Source map "sections" field is not an object.'));
    } else {
      sourceMap.sections.forEach((section: any, i: number) => {
        if (!section.map || !(typeof section.map === "object" && section.map !== null)) {
          errors.push(new Error(`Index map section ${i} is missing a "map" field or it is invalid.`));
        } else {
          // NB: this allows arbitrarily nested index maps, but is that
          // intended by the spec?
          const subErrors = validateSourceMap(section.map);
          errors.push(...subErrors);
        }
      });
    }
  } else {
    if ('sourceRoot' in sourceMap) {
      if (typeof sourceMap.sourceRoot !== "string")
        errors.push(new Error('Source map "sourceRoot" field is not a string.'));
    }

    if (!sourceMap.sources || !Array.isArray(sourceMap.sources)) {
      errors.push(new Error('Source map "sources" field is invalid or missing.'));
    } else {
      sourceMap.sources.forEach((x: unknown, i: number) => {
        if (typeof x !== "string" && x !== null) errors.push(new Error(`There is a source with an invalid format on the index ${i}. Each source should be defined as a string or null`))
      })
    }

    if ("names" in sourceMap) {
      if (!Array.isArray(sourceMap.names)) {
        errors.push(new Error('Source map "names" field is invalid.'));
      } else {
        sourceMap.names.forEach((x: unknown, i: number) => {
          if (typeof x !== "string") errors.push(new Error(`There is a name with an invalid format on the index ${i}. Each name should be defined as a string`))
        })
      }
    }

    if (!("mappings" in sourceMap)) {
      errors.push(new Error('Source map "mappings" field is missing.'));
    } else if (typeof sourceMap.mappings !== "string") {
      errors.push(new Error('Source map "mappings" field is not a string.'));
    }

    if ('sourcesContent' in sourceMap) {
      if (!Array.isArray(sourceMap.sourcesContent))
        errors.push(new Error('Source map "sourcesContent" field is invalid.'));
      else {
        sourceMap.sourcesContent.forEach((x: unknown, i: number) => {
          if (x !== null && typeof x !== "string") errors.push(new Error(`There is a source content with an invalid format on the index ${i}. Each content should be defined as a strings or null`))
        })
      }
    }

    if ("ignoreList" in sourceMap) {
      if (!Array.isArray(sourceMap.ignoreList))
        errors.push(new Error('Source map "ignoreList" field is invalid.'));
      else {
        sourceMap.ignoreList.forEach((x: unknown, i: number) => {
          if (!Number.isInteger(x))
            errors.push(
              new Error(
                `There is an ignoreList entry with an invalid format at the index ${i}. Each content should be defined as a number`,
              ),
            );
          if ((x as number) >= sourceMap.sources.length || (x as number) < 0)
            errors.push(
              new Error(
                `There is an ignoreList entry at index ${i} with an out-of-bounds value ${x}.`,
              ),
            );
        });
      }
    }
  }

  return errors;
}

export class SourceMapFormatValidator extends Validator {
  validate({ sourceMap }: ValidationContext): ValidationResult {
    return ValidationResult.from(validateSourceMap(sourceMap));
  }
}
