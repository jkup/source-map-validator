import { Validator } from "../util/Validator.js";
import { TestingFile } from "../util/TestingFile.js";
import { collectSourceFiles } from "../util/collectSourceFiles.js";
import { ValidationResult, ValidationSuccess } from "../util/ValidationResult.js";
import { decodeOriginalScopes, decodeGeneratedRanges, getOriginalScopeChain, getGeneratedRangeChain } from "tc39-proposal-scope-mapping";
import { SourceMapConsumer } from "source-map";
import type { SourceMap } from "../util/sourceMap.js";
import type { ValidationContext } from "../util/ValidationContext.js";
import type { OriginalLocation, GeneratedRange, OriginalScope, ScopeKind, Location } from "tc39-proposal-scope-mapping";

export class SourceMapScopesValidator extends Validator {
  private readonly scopeKindsWithName = new Set<ScopeKind>(["module", "function", "class"]);

  async validate({ sourceMap, originalFolderPath, generatedFilePath }: ValidationContext): Promise<ValidationResult> {
    if (!sourceMap.hasOwnProperty("originalScopes") && !sourceMap.hasOwnProperty("generatedRanges")) {
      return ValidationSuccess.create();
    }

    const errors: Error[] = [];
    const { originalScopes, generatedRanges } = sourceMap;

    if (!Array.isArray(originalScopes)) {
      errors.push(new Error(`Source map "originalScopes" has a wrong type. Expected array of strings, but it's ${(originalScopes as object)?.constructor?.name?.toLowerCase()}`));
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
    let decodedGeneratedRanges: GeneratedRange;

    try {
      decodedOriginalScopes = decodeOriginalScopes(originalScopes, sourceMap.names ?? []);
    } catch (e: any) {
      errors.push(e);
      return ValidationResult.from(errors);
    }

    try {
      decodedGeneratedRanges = decodeGeneratedRanges(generatedRanges, sourceMap.names ?? [], decodedOriginalScopes);
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

    await this.validateMappingConsistency(originalScopes, generatedRanges, errors, sourceMap);

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

    // TODO: Examples inside the scope proposal have zero-based line numbers, but the source maps themself have one-based line numbers
    if (!originalFile.isMappingReasonable(originalScope.start.line + 1, originalScope.start.column)) {
      const notReasonableScopeMessage = this.formatWeirdOriginalScopeMessage(originalScope.start, originalFile);
      errors.push(new Error(`Start of the ${notReasonableScopeMessage}`));
    }
    if (!originalFile.isMappingReasonable(originalScope.end.line + 1, originalScope.end.column)) {
      const notReasonableScopeMessage = this.formatWeirdOriginalScopeMessage(originalScope.end, originalFile)
      errors.push(new Error(`End of the ${notReasonableScopeMessage}`));
    }

    if (originalScope.name !== undefined && !this.scopeKindsWithName.has(originalScope.kind)) {
      errors.push(new Error(`The scope (path) has a name property, but its kind is '${originalScope.kind}'. Only the next scope kinds are allowed to have the name property: ${Array.from(this.scopeKindsWithName).join(', ')}`));
    }

    if (this.isLocationBefore(originalScope.end, originalScope.start)) {
      errors.push(new Error(`The original scope's end location is before its start location (${path})`));
    }
    if (originalScope.children?.length) {
      if (this.isLocationBefore(originalScope.children[0].start, originalScope.start)) {
        errors.push(new Error(`The original scope's start location is outside of its parent (${path})`));
      }
      if (this.isLocationBefore(originalScope.end, originalScope.children[originalScope.children.length - 1].end)) {
        errors.push(new Error(`The original scope's end location is outside of its parent (${path})`));
      }
      for (let i = 0; i < originalScope.children.length - 1; i++) {
        if (this.isLocationBefore(originalScope.children[i + 1].start, originalScope.children[i].end)) {
          errors.push(new Error(`The sibling original scopes overlap (${path})`));
        }
      }
    }

    originalScope.children?.forEach((x, index) => {
      this.validateOriginalScope(`${path}.children[${index}]`, x, errors, sourceMap, originalFiles);
    })
  }

  private validateGeneratedRange(
      path: string,
      generatedRange: GeneratedRange,
      errors: Error[],
      sourceMap: SourceMap,
      originalFiles: Map<string, TestingFile>,
      generatedFile: TestingFile
  ) {
    if (!generatedFile.isMappingReasonable(generatedRange.start.line + 1, generatedRange.start.column)) {
      errors.push(new Error(`Start of the generated range (${path}) looks not reasonable (${generatedRange.start.line}:${generatedRange.start.column})`));
    }
    if (!generatedFile.isMappingReasonable(generatedRange.end.line + 1, generatedRange.end.column)) {
      errors.push(new Error(`End of the generated range (${path}) looks not reasonable (${generatedRange.end.line}:${generatedRange.end.column})`));
    }

    const original = generatedRange.original;

    if (original !== undefined) {
      const { callsite, bindings, scope }  = original;

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

        if (!originalFile.isMappingReasonable(callsite.line + 1, callsite.column)) {
          errors.push(new Error(`Callsite in the generated range (${path}) in "${originalFile.path} (${callsite.line}:${callsite.column})" looks not reasonable`));
        }
      }

      bindings?.forEach((value, index) => {
        if (typeof value === "string" || value === undefined) return
        if (Array.isArray(value)) {
          value.forEach((segment, segmentIndex) => {
            if (Array.isArray(segment)) {
              const [location] = segment;

              if (!generatedFile.isMappingReasonable(location.line + 1, location.column)) {
                errors.push(new Error(`Multi value segment ${segmentIndex}, in value binding with index ${index} of the generated range (${path}) contains unreasonable location to the generated file (${location.line}:${location.column})`));
              }
            }
          })
        }

        errors.push(new Error(`Unexpected binding type (${typeof value}) on index ${index}`));
      });
    }

    if (this.isLocationBefore(generatedRange.end, generatedRange.start)) {
      errors.push(new Error(`The generated range's end location is before its start location (${path})`));
    }
    if (generatedRange.children?.length) {
      if (this.isLocationBefore(generatedRange.children[0].start, generatedRange.start)) {
        errors.push(new Error(`The generated range's start location is outside of its parent (${path})`));
      }
      if (this.isLocationBefore(generatedRange.end, generatedRange.children[generatedRange.children.length - 1].end)) {
        errors.push(new Error(`The generated range's end location is outside of its parent (${path})`));
      }
      for (let i = 0; i < generatedRange.children.length - 1; i++) {
        if (this.isLocationBefore(generatedRange.children[i + 1].start, generatedRange.children[i].end)) {
          errors.push(new Error(`The sibling original scopes overlap (${path})`));
        }
      }
    }

    generatedRange.children?.forEach((x, index) => {
      this.validateGeneratedRange(`${path}.children[${index}]`, x, errors, sourceMap, originalFiles, generatedFile);
    })
  }

  private async validateMappingConsistency(
    originalScopes: OriginalScope[],
    generatedRange: GeneratedRange,
    errors: Error[],
    sourceMap: SourceMap,
  ) {
    try {
      await SourceMapConsumer.with(sourceMap, null, (consumer) => {
        consumer.eachMapping((mapping) => {
          const sourceIndex = sourceMap.sources.indexOf((source: string) => source === mapping.source);

          const generatedRangeChain = getGeneratedRangeChain({
            line: mapping.generatedLine - 1,
            column: mapping.generatedColumn
          }, generatedRange);

          let originalScopeChain = getOriginalScopeChain({
            line: mapping.originalLine - 1,
            column: mapping.originalColumn,
            sourceIndex
          }, originalScopes[sourceIndex]);

          for (const generatedRange of generatedRangeChain) {
            if (!generatedRange.original) {
              continue;
            }

            if (generatedRange.original.callsite) {
              originalScopeChain = getOriginalScopeChain(
                generatedRange.original.callsite,
                originalScopes[sourceIndex]
              );
            }

            if (!originalScopeChain.includes(generatedRange.original.scope)) {
              errors.push(new Error(`OriginalScope reference is inconsistent with mappings`));
            }
          }
        });
      });
    } catch (exn : any) {
      errors.push(new Error(exn.message));
    }
  }

  private isLocationBefore(a: Location, b: Location) {
    return a.line < b.line || (a.line === b.line && a.column < b.column);
  }

  private formatWeirdOriginalScopeMessage(scopeLocation: OriginalLocation, originalFile: TestingFile): string {
    return `scope from "${originalFile.path} (${scopeLocation.line}:${scopeLocation.column})" looks not reasonable`;
  }
}