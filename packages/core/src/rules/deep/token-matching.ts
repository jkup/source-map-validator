import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { splitLines, extractTokenAt, buildSourceLines } from '../../utf16.js';
import { forEachSegment, segmentLocation } from '../../rule-utils.js';

export const tokenMatchingRule: Rule = {
  id: 'token-matching',
  description: 'Named mappings should point to matching tokens in generated and original sources',
  severity: 'warning',
  level: 3,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap || !context.generatedSource) return [];

    const diagnostics: Diagnostic[] = [];
    const { mappings, sources, sourcesContent, names } = context.sourceMap;

    if (!names || names.length === 0) return [];

    const generatedLines = splitLines(context.generatedSource);

    const sourceLines = buildSourceLines(sources, sourcesContent, context.originalSources);

    let mismatchCount = 0;
    const MAX_MISMATCHES = 20; // Cap to avoid flooding output

    forEachSegment(mappings, (info) => {
      const { segment } = info;

      if (
        segment.nameIndex === undefined ||
        segment.sourceIndex === undefined ||
        segment.originalLine === undefined ||
        segment.originalColumn === undefined
      ) {
        return;
      }

      if (mismatchCount >= MAX_MISMATCHES) return;

      const expectedName = names[segment.nameIndex] ?? '';
      if (!expectedName) return;

      // Check original side
      if (info.lineIdx < generatedLines.length) {
        const origLines = sourceLines.get(segment.sourceIndex);
        if (origLines && segment.originalLine < origLines.length) {
          const origLine = origLines[segment.originalLine];
          if (!origLine) return;
          const origToken = extractTokenAt(origLine, segment.originalColumn);

          if (origToken !== null && origToken !== expectedName) {
            diagnostics.push({
              rule: this.id,
              severity: 'warning',
              message: `Mapping #${info.mappingIndex} names "${expectedName}" but the token at the original position is "${origToken}"`,
              location: {
                ...segmentLocation(info),
                originalSource: sources[segment.sourceIndex] ?? undefined,
                originalLine: segment.originalLine + 1,
                originalColumn: segment.originalColumn,
              },
            });
            mismatchCount++;
          }
        }
      }
    });

    if (mismatchCount >= MAX_MISMATCHES) {
      diagnostics.push({
        rule: this.id,
        severity: 'info',
        message: `Token mismatch reporting capped at ${MAX_MISMATCHES}. There may be more mismatches.`,
      });
    }

    return diagnostics;
  },
};
