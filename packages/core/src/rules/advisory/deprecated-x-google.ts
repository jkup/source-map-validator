import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const deprecatedXGoogleRule: Rule = {
  id: 'deprecated-x-google',
  description: 'Warn about deprecated `x_google_ignoreList` field when `ignoreList` is absent',
  severity: 'info',
  level: 4,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    if ('x_google_ignoreList' in parsed && !('ignoreList' in parsed)) {
      return [
        {
          rule: this.id,
          severity: 'info',
          message:
            'Source map uses the deprecated `x_google_ignoreList` field. Consider migrating to the standardized `ignoreList` field (ECMA-426). Browsers fall back to `x_google_ignoreList` but the standardized field is preferred.',
        },
      ];
    }

    return [];
  },
};
