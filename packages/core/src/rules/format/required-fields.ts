import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const requiredFieldsRule: Rule = {
  id: 'required-fields',
  description: 'Source map must contain all required fields: version, sources, mappings',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    const diagnostics: Diagnostic[] = [];

    // An index map uses `sections` instead of `sources` + `mappings`
    const isIndexMap = 'sections' in parsed;

    if (isIndexMap) {
      if (!('sections' in parsed)) {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: 'Index map is missing required field `sections`',
        });
      }
    } else {
      if (!('sources' in parsed)) {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: 'Missing required field `sources`',
        });
      }

      if (!('mappings' in parsed)) {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: 'Missing required field `mappings`',
        });
      }
    }

    return diagnostics;
  },
};
