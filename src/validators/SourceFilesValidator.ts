import fs from "fs";
import path from "path";
import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import type { ValidationContext } from "../util/ValidationContext.js";

export class SourceFilesValidator extends Validator {
  validate(context: ValidationContext): ValidationResult {
    const errors: Error[] = [];
    const { sources, sourcesContent = [] } = context.sourceMap

    function check(sources : any) {
      sources.forEach((sourceFileName: string | null, index: number) => {
        const fullPath = sourceFileName === null ? null : path.join(context.originalFolderPath, sourceFileName);
        // If the path is null, we won't use the source in subsequent passes so
        // it can be ignored. Otherwise ensure the source makes sense.
        if (fullPath !== null) {
          if ((!fullPath || !fs.existsSync(fullPath)) && sourcesContent[index] == undefined) {
            errors.push(new Error(`Source file not found: ${sourceFileName} ${sourcesContent[index]}`));
          }
        }
      });
    };

    if ("sections" in context.sourceMap) {
      context.sourceMap.sections.forEach((section : any) => {
        check(section.map.sources);
      });
    } else {
      check(sources);
    }

    return ValidationResult.from(errors)
  }
}
