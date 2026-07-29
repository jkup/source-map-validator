import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const versionFieldRule: Rule = {
  id: 'version-field',
  description: 'The `version` field must be the integer 3',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    if (!('version' in parsed)) {
      return [
        {
          rule: this.id,
          severity: 'error',
          message: 'Missing required field `version`',
        },
      ];
    }

    const version = parsed.version;

    if (version === '3') {
      return [
        {
          rule: this.id,
          severity: 'error',
          message: '`version` is the string "3" but must be the integer 3',
        },
      ];
    }

    if (version !== 3) {
      return [
        {
          rule: this.id,
          severity: 'error',
          message: `\`version\` is ${JSON.stringify(version)} but must be the integer 3`,
        },
      ];
    }

    return [];
  },
};
