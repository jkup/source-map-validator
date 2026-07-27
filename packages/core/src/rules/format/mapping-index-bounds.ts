import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { forEachSegment, segmentLocation } from '../../rule-utils.js';

export const mappingIndexBoundsRule: Rule = {
  id: 'mapping-index-bounds',
  description: 'Source and name indices in mappings must be within array bounds',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap) return [];

    const { mappings, sources, names } = context.sourceMap;
    const diagnostics: Diagnostic[] = [];

    forEachSegment(mappings, (info) => {
      const { segment } = info;

      if (segment.sourceIndex !== undefined) {
        if (segment.sourceIndex < 0 || segment.sourceIndex >= sources.length) {
          diagnostics.push({
            rule: this.id,
            severity: 'error',
            message: `Mapping #${info.mappingIndex} references source index ${segment.sourceIndex} but \`sources\` only has ${sources.length} entries`,
            location: segmentLocation(info),
          });
        }
      }

      if (segment.nameIndex !== undefined) {
        const nameCount = names?.length ?? 0;
        if (segment.nameIndex < 0 || segment.nameIndex >= nameCount) {
          diagnostics.push({
            rule: this.id,
            severity: 'error',
            message: `Mapping #${info.mappingIndex} references name index ${segment.nameIndex} but \`names\` only has ${nameCount} entries`,
            location: segmentLocation(info),
          });
        }
      }
    });

    return diagnostics;
  },
};
