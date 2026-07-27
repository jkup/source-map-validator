import { parsedObject, KNOWN_FIELDS } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const extensionFieldsRule: Rule = {
  id: 'extension-fields',
  description: 'Report unrecognized or extension fields in the source map',
  severity: 'info',
  level: 4,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    const diagnostics: Diagnostic[] = [];
    const extensions: string[] = [];
    const unknowns: string[] = [];

    for (const key of Object.keys(parsed)) {
      if (KNOWN_FIELDS.has(key)) continue;

      if (key.startsWith('x_')) {
        extensions.push(key);
      } else {
        unknowns.push(key);
      }
    }

    if (extensions.length > 0) {
      diagnostics.push({
        rule: this.id,
        severity: 'info',
        message: `Source map contains extension fields: ${extensions.join(', ')}. These are non-standard and may not be recognized by all consumers.`,
      });
    }

    if (unknowns.length > 0) {
      diagnostics.push({
        rule: this.id,
        severity: 'info',
        message: `Source map contains unrecognized fields: ${unknowns.join(', ')}. Per ECMA-426, consumers should ignore unrecognized properties.`,
      });
    }

    return diagnostics;
  },
};
