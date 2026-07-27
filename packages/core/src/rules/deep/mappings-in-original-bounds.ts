import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { utf16Length, buildSourceLines } from '../../utf16.js';
import { forEachSegment, segmentLocation } from '../../rule-utils.js';

export const mappingsInOriginalBoundsRule: Rule = {
  id: 'mappings-in-original-bounds',
  description: 'Mapping positions must not exceed the original source file boundaries',
  severity: 'error',
  level: 3,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap) return [];

    const diagnostics: Diagnostic[] = [];
    const { mappings, sources, sourcesContent } = context.sourceMap;

    const sourceLines = buildSourceLines(sources, sourcesContent, context.originalSources);

    forEachSegment(mappings, (info) => {
      const { segment } = info;

      if (
        segment.sourceIndex === undefined ||
        segment.originalLine === undefined ||
        segment.originalColumn === undefined
      ) {
        return;
      }

      const lines = sourceLines.get(segment.sourceIndex);
      if (!lines) return;

      const originalFields = {
        originalSource: sources[segment.sourceIndex] ?? undefined,
        originalLine: segment.originalLine + 1,
        originalColumn: segment.originalColumn,
      };

      if (segment.originalLine >= lines.length) {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: `Mapping #${info.mappingIndex} references original line ${segment.originalLine + 1} in "${sources[segment.sourceIndex]}" but the file only has ${lines.length} lines`,
          location: { ...segmentLocation(info), ...originalFields },
        });
      } else {
        const lineLength = utf16Length(lines[segment.originalLine]!);
        if (segment.originalColumn > lineLength) {
          diagnostics.push({
            rule: this.id,
            severity: 'error',
            message: `Mapping #${info.mappingIndex} references original column ${segment.originalColumn} on line ${segment.originalLine + 1} in "${sources[segment.sourceIndex]}" but the line is only ${lineLength} code units long`,
            location: { ...segmentLocation(info), ...originalFields },
          });
        }
      }
    });

    return diagnostics;
  },
};
