import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { segmentLocation } from '../../rule-utils.js';
import { splitLines, utf16Length } from '../../utf16.js';

const RULE_ID = 'mappings-in-generated-bounds';

function checkWasm(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const byteLength = context.generatedSource!.length;
  let mappingIndex = 0;

  for (let lineIdx = 0; lineIdx < context.sourceMap!.mappings.length; lineIdx++) {
    const line = context.sourceMap!.mappings[lineIdx]!;

    if (lineIdx > 0 && line.length > 0) {
      diagnostics.push({
        rule: RULE_ID,
        severity: 'error',
        message: `${line.length} mapping(s) reference generated line ${lineIdx + 1} but WASM files have no line structure — all mappings must be on line 1`,
        location: {
          generatedLine: lineIdx + 1,
          mappingIndex,
        },
      });
      mappingIndex += line.length;
      continue;
    }

    for (const segment of line) {
      if (segment.generatedColumn > byteLength) {
        const info = { segment, lineIdx, mappingIndex };
        diagnostics.push({
          rule: RULE_ID,
          severity: 'error',
          message: `Mapping #${mappingIndex} references byte offset ${segment.generatedColumn} but the WASM file is only ${byteLength} bytes`,
          location: segmentLocation(info),
        });
      }
      mappingIndex++;
    }
  }

  return diagnostics;
}

export const mappingsInGeneratedBoundsRule: Rule = {
  id: RULE_ID,
  description: 'Mapping positions must not exceed the generated file boundaries',
  severity: 'error',
  level: 2,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap || !context.generatedSource) return [];

    if (context.generatedFileType === 'wasm') {
      return checkWasm(context);
    }

    const diagnostics: Diagnostic[] = [];
    const lines = splitLines(context.generatedSource);
    const totalLines = lines.length;
    let mappingIndex = 0;

    for (let lineIdx = 0; lineIdx < context.sourceMap.mappings.length; lineIdx++) {
      const line = context.sourceMap.mappings[lineIdx]!;

      if (lineIdx >= totalLines) {
        if (line.length > 0) {
          diagnostics.push({
            rule: this.id,
            severity: 'error',
            message: `${line.length} mapping(s) reference generated line ${lineIdx + 1} but the generated file only has ${totalLines} lines`,
            location: {
              generatedLine: lineIdx + 1,
              mappingIndex,
            },
          });
        }
        mappingIndex += line.length;
        continue;
      }

      const lineLength = utf16Length(lines[lineIdx]!);

      for (const segment of line) {
        if (segment.generatedColumn > lineLength) {
          const info = { segment, lineIdx, mappingIndex };
          diagnostics.push({
            rule: this.id,
            severity: 'error',
            message: `Mapping #${mappingIndex} references generated column ${segment.generatedColumn} but line ${lineIdx + 1} is only ${lineLength} code units long`,
            location: segmentLocation(info),
          });
        }
        mappingIndex++;
      }
    }

    return diagnostics;
  },
};
