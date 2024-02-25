import { Validator } from "../util/Validator.js";
import { TestingFile } from "../util/TestingFile.js";
import { collectSourceFiles } from "../util/collectSourceFiles.js";
import { ValidationResult, ValidationSuccess } from "../util/ValidationResult.js";
import { decodeOriginalScopes, decodeGeneratedScopes } from "scope-mapping";
import type { SourceMap } from "../util/sourceMap.js";
import type { ValidationContext } from "../util/ValidationContext.js";
import type { OriginalLocation, GeneratedScope, Location, OriginalScope, ScopeKind } from "scope-mapping";

export class SourceMapScopesValidator extends Validator {
  private readonly scopeKindsWithName = new Set<ScopeKind>(["module", "function", "class"]);

  validate({ sourceMap, originalFolderPath, generatedFilePath }: ValidationContext): ValidationResult {
    if (!sourceMap.hasOwnProperty("originalScopes") && !sourceMap.hasOwnProperty("generatedRanges")) {
      return ValidationSuccess.create();
    }

    const errors: Error[] = [];
    const { originalScopes, generatedRanges } = sourceMap;

    if (!Array.isArray(originalScopes)) {
      errors.push(new Error(`Source map "originalScopes" has a wrong type. Expected array of strings, but it's ${originalScopes?.constructor?.name?.toLowerCase()}`));
    } else {
      originalScopes.forEach((encodedScope, index) => {
        const encodedScopeType = typeof encodedScope;
        if (encodedScopeType !== "string") {
          errors.push(new Error(`Source map "originalScopes" has an item with a wrong type. Only strings are allowed, but there is an item with type "${encodedScopeType}" on the position ${index}`));
        }
      })
    }

    const generatedRangesType = typeof generatedRanges;
    if (generatedRangesType !== "string") {
      errors.push(new Error(`Source map "generatedRanges" has a wrong type. Expected "string", but got "${generatedRangesType}"`));
    }

    if (errors.length !== 0) return ValidationResult.from(errors);

    let decodedOriginalScopes: OriginalScope[];
    let decodedGeneratedRanges: GeneratedScope;

    try {
      decodedOriginalScopes = decodeOriginalScopes(originalScopes, sourceMap.names ?? []);
    } catch (e: any) {
      errors.push(e);
      return ValidationResult.from(errors);
    }

    try {
      decodedGeneratedRanges = decodeGeneratedScopes(generatedRanges, sourceMap.names ?? [], originalScopes);
    } catch (e: any) {
      errors.push(e);
      return ValidationResult.from(errors);
    }

    const originalFiles = collectSourceFiles(sourceMap, originalFolderPath);
    const generatedFile = TestingFile.fromPathBasedOnFileExtension(generatedFilePath);

    decodedOriginalScopes.forEach((originalScope, index) => {
      this.validateOriginalScope(`originalScopes[${index}]`, originalScope, errors, sourceMap, originalFiles);
    });

    this.validateGeneratedRange("generatedRange", decodedGeneratedRanges, errors, sourceMap, originalFiles, generatedFile);

    return ValidationResult.from(errors);
  }

  private validateOriginalScope(
      path: string,
      originalScope: OriginalScope,
      errors: Error[],
      sourceMap: SourceMap,
      originalFiles: Map<string, TestingFile>,
  ) {
    // TODO: Is it possible that `start` of the scope and its `end` have different `sourceIndex`? Could we remove those duplication?
    if (originalScope.start.sourceIndex !== originalScope.end.sourceIndex) {
      errors.push(new Error(`Looks weird. The original scope (${path}) has different sources for its 'start' and 'end' positions`));
    }

    const sourceIndex = originalScope.start.sourceIndex;
    const sourceName = sourceMap.sources[sourceIndex];

    if (sourceName === undefined) {
      errors.push(new Error(`The original scope (${path}) uses 'sourceIndex' ${sourceIndex} that map to an undefined source`));
      return;
    }

    const originalFile = originalFiles.get(sourceName);

    if (originalFile === undefined) {
      errors.push(new Error(`There is no content for file with the path "${sourceName}" on a disk or in the\`sourcesContent\` section, but it's used in the original scope (${path})`));
      return;
    }

    if (!originalFile.isMappingReasonable(originalScope.start.line, originalScope.start.column)) {
      const notReasonableScopeMessage = this.formatWeirdOriginalScopeMessage(originalScope.start, originalFile);
      errors.push(new Error(`Start of the ${notReasonableScopeMessage}`));
    }
    if (!originalFile.isMappingReasonable(originalScope.end.line, originalScope.end.line)) {
      const notReasonableScopeMessage = this.formatWeirdOriginalScopeMessage(originalScope.end, originalFile)
      errors.push(new Error(`End of the ${notReasonableScopeMessage}`));
    }

    if (originalScope.name !== undefined && !this.scopeKindsWithName.has(originalScope.kind)) {
      errors.push(new Error(`The scope (path) has a name property, but its kind is '${originalScope.kind}'. Only the next scope kinds are allowed to have the name property: ${Array.from(this.scopeKindsWithName).join(', ')}`));
    }

    originalScope.children?.forEach((x, index) => {
      this.validateOriginalScope(`${path}.children[${index}]`, x, errors, sourceMap, originalFiles);
    })
  }

  private validateGeneratedRange(
      path: string,
      generatedRange: GeneratedScope,
      errors: Error[],
      sourceMap: SourceMap,
      originalFiles: Map<string, TestingFile>,
      generatedFile: TestingFile
  ) {
    if (!generatedFile.isMappingReasonable(generatedRange.start.line, generatedRange.start.column)) {
      errors.push(new Error(`Start of the generated range (${path}) looks not reasonable (${generatedRange.start.line}:${generatedRange.start.column})`));
    }
    if (!generatedFile.isMappingReasonable(generatedRange.end.line, generatedRange.end.line)) {
      errors.push(new Error(`End of the generated range (${path}) looks not reasonable (${generatedRange.start.line}:${generatedRange.start.column})`));
    }

    const original = generatedRange.original;

    if (original !== undefined) {
      const { callsite, values, scope }  = original;

      if (callsite !== undefined) {
        const sourceIndex = callsite.sourceIndex;
        const sourceName = sourceMap.sources[sourceIndex];

        if (sourceName === undefined) {
          errors.push(new Error(`The callsite of the generated range (${path}) uses 'sourceIndex' ${sourceIndex} that map to an undefined source`));
          return;
        }

        const originalFile = originalFiles.get(sourceName);

        if (originalFile === undefined) {
          errors.push(new Error(`There is no content for file with the path "${sourceName}" on a disk or in the\`sourcesContent\` section, but it's used in the generated range (${path})`));
          return;
        }

        if (!originalFile.isMappingReasonable(callsite.line, callsite.column)) {
          errors.push(new Error(`Callsite in the generated range (${path}) in "${originalFile.path} (${callsite.line}:${callsite.column})" looks not reasonable`));
        }
      }

      values.forEach((value, index) => {
        value.forEach((segment, segmentIndex) => {
          if (Array.isArray(segment)) {
            const [location] = segment;

            if (!generatedFile.isMappingReasonable(location.line, location.line)) {
              errors.push(new Error(`Multi value segment ${segmentIndex}, in value binding with index ${index} of the generated range (${path}) contains unreasonable location to the generated file (${location.line}:${location.column})`));
            }
          }
        })
      });
    }

    generatedRange.children?.forEach((x, index) => {
      this.validateGeneratedRange(`${path}.children[${index}]`, x, errors, sourceMap, originalFiles, generatedFile);
    })
  }

  private formatWeirdOriginalScopeMessage(scopeLocation: OriginalLocation, originalFile: TestingFile): string {
    return `scope from "${originalFile.path} (${scopeLocation.line}:${scopeLocation.column})" looks not reasonable`;
  }
}