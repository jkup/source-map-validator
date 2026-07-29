import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { forEachSegment, segmentLocation } from '../../rule-utils.js';

export const nonNegativePositionsRule: Rule = {
  id: 'non-negative-positions',
  description: 'All decoded positions (columns, lines, indices) must be non-negative',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap) return [];

    const diagnostics: Diagnostic[] = [];

    forEachSegment(context.sourceMap.mappings, (info) => {
      const { segment } = info;
      const checks: [unknown, string][] = [
        [segment.generatedColumn, 'generated column'],
        [segment.originalLine, 'original line'],
        [segment.originalColumn, 'original column'],
        [segment.sourceIndex, 'source index'],
        [segment.nameIndex, 'name index'],
      ];

      for (const [value, label] of checks) {
        if (typeof value === 'number' && value < 0) {
          diagnostics.push({
            rule: this.id,
            severity: 'error',
            message: `Mapping #${info.mappingIndex} has negative ${label}: ${value}`,
            location: segmentLocation(info),
          });
        }
      }
    });

    return diagnostics;
  },
};
