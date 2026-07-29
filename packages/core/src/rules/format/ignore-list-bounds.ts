import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const ignoreListBoundsRule: Rule = {
  id: 'ignore-list-bounds',
  description: '`ignoreList` entries must be valid indices into `sources`',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    if (!Array.isArray(parsed.ignoreList) || !Array.isArray(parsed.sources)) {
      return [];
    }

    const diagnostics: Diagnostic[] = [];
    const sourcesLength = parsed.sources.length;
    const seen = new Set<number>();

    for (let i = 0; i < parsed.ignoreList.length; i++) {
      const idx = parsed.ignoreList[i];
      if (typeof idx !== 'number') continue; // field-types rule handles this

      if (idx < 0 || idx >= sourcesLength) {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: `\`ignoreList[${i}]\` is ${idx} but \`sources\` only has ${sourcesLength} entries (valid indices: 0-${sourcesLength - 1})`,
        });
      }

      if (seen.has(idx)) {
        diagnostics.push({
          rule: this.id,
          severity: 'warning',
          message: `\`ignoreList\` contains duplicate index ${idx}`,
        });
      }
      seen.add(idx);
    }

    return diagnostics;
  },
};
