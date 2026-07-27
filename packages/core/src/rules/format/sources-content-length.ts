import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const sourcesContentLengthRule: Rule = {
  id: 'sources-content-length',
  description: '`sourcesContent` array length must match `sources` array length',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    if (!Array.isArray(parsed.sources) || !Array.isArray(parsed.sourcesContent)) {
      return [];
    }

    if (parsed.sourcesContent.length !== parsed.sources.length) {
      return [
        {
          rule: this.id,
          severity: 'error',
          message: `\`sourcesContent\` has ${parsed.sourcesContent.length} entries but \`sources\` has ${parsed.sources.length} — they must be the same length`,
        },
      ];
    }

    return [];
  },
};
