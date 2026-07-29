import type { Rule, RuleContext, Diagnostic } from '../../types.js';

const SOURCE_MAPPING_URL_RE = /\/\/[#@]\s*sourceMappingURL\s*=\s*(\S*?)\s*$/m;
const CSS_SOURCE_MAPPING_URL_RE = /\/\*[#@]\s*sourceMappingURL\s*=\s*(\S*?)\s*\*\/\s*$/m;

export const sourceMappingUrlRule: Rule = {
  id: 'source-mapping-url',
  description: 'Generated file should contain a sourceMappingURL comment',
  severity: 'warning',
  level: 2,

  check(context: RuleContext): Diagnostic[] {
    if (!context.generatedSource) return [];

    const content = context.generatedSource;
    const jsMatch = content.match(SOURCE_MAPPING_URL_RE);
    const cssMatch = content.match(CSS_SOURCE_MAPPING_URL_RE);
    const match = jsMatch || cssMatch;

    if (!match) {
      return [
        {
          rule: this.id,
          severity: 'warning',
          message:
            'Generated file does not contain a `//# sourceMappingURL=` comment. Browsers and tools may not find the source map.',
        },
      ];
    }

    const url = match[1];
    if (!url || url.length === 0) {
      return [
        {
          rule: this.id,
          severity: 'warning',
          message: '`sourceMappingURL` comment is present but the URL is empty',
        },
      ];
    }

    return [];
  },
};
