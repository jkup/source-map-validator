import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const validJsonRule: Rule = {
  id: 'valid-json',
  description: 'Source map must be valid JSON',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for BOM
    if (context.rawJson.charCodeAt(0) === 0xfeff) {
      diagnostics.push({
        rule: this.id,
        severity: 'warning',
        message:
          'Source map starts with a UTF-8 BOM (U+FEFF). This may cause issues with some consumers.',
      });
    }

    // The validator's tryParse already handled )]}' prefix stripping and
    // BOM removal before parsing. If parsed is null, JSON was invalid.
    if (context.parsed === null) {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: 'Source map is not valid JSON',
      });
    } else if (typeof context.parsed !== 'object' || Array.isArray(context.parsed)) {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: `Source map must be a JSON object, got ${Array.isArray(context.parsed) ? 'array' : typeof context.parsed}`,
      });
    }

    return diagnostics;
  },
};
