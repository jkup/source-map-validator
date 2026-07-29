import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const scopesFieldTypeRule: Rule = {
  id: 'scopes-field-type',
  description: 'The `scopes` field must be a string if present',
  severity: 'error',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    if (!('scopes' in parsed)) return [];

    if (typeof parsed.scopes !== 'string') {
      return [
        {
          rule: this.id,
          severity: 'error',
          message: `\`scopes\` must be a string, got ${typeof parsed.scopes}`,
        },
      ];
    }

    return [];
  },
};
