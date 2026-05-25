import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import { parseUnsignedVLQ } from "../util/vlq.js";
import type { ValidationContext } from "../util/ValidationContext.js";

export class SourceMapRangeMappingsValidator extends Validator {
  private parseRangeMappings(mappings : String) : number[][] {
    let indices : number[][] = [];

    for (const line of mappings.split(";")) {
      let currentLine : number[] = [];
      let relativeIndex = null;
      const iter = line[Symbol.iterator]();

      for(;;) {
        let vlq = parseUnsignedVLQ(iter);
        if (vlq === null) {
          throw new Error("Invalid character in range mapping");
        } else if (vlq === "eof") {
          break;
        }

        if (relativeIndex !== null && vlq === 0) {
          throw new Error("Invalid duplicate relative index in range mapping");
        }

        if (relativeIndex == null) {
          relativeIndex = vlq;
        } else {
          relativeIndex += vlq;
        }

        currentLine.push(relativeIndex);
      }

      indices.push(currentLine);
    }

    return indices;
  }

  async validate({ sourceMap }: ValidationContext): Promise<ValidationResult> {
    const errors: Error[] = [];

    try {
      if ("rangeMappings" in sourceMap) {
        if (typeof sourceMap.rangeMappings !== "string") {
          throw new Error("Invalid rangeMappings: not a string");
        } else {
          const indices = this.parseRangeMappings(sourceMap.rangeMappings);
          // We assume mappings is correctly formatted due to previous checks
          const mappingLines = sourceMap.mappings.split(";");
          for (let line = 0; line < indices.length; line++) {
            // The line in mappings (or mappings entirely) may be empty, in which case
            // the count is zero and any range mapping into that line will be an error.
            const mappingCount = mappingLines[line] ? mappingLines[line].split(",").length : 0;
            for (let rangeIndex = 0; rangeIndex < indices[line].length; rangeIndex++) {
              if (indices[line][rangeIndex] >= mappingCount) {
                throw new Error("Invalid rangeMapping: out of range mapping on line " + line + " with index " + indices[line][rangeIndex]);
              }
            }
          }
        }
      }
    } catch (exn : any) {
      errors.push(exn);
    }

    return ValidationResult.from(errors);
  }
}
