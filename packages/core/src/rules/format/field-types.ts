import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { validateArrayField } from '../../rule-utils.js';

export const fieldTypesRule: Rule = {
  id: 'field-types',
  description: 'All fields must have the correct types per ECMA-426',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    const diagnostics: Diagnostic[] = [];

    // sources: array of (string | null)
    diagnostics.push(
      ...validateArrayField(this.id, parsed, 'sources', (entry) =>
        entry !== null && typeof entry !== 'string'
          ? `must be a string or null, got ${typeof entry}`
          : null,
      ),
    );

    // sourcesContent: array of (string | null)
    diagnostics.push(
      ...validateArrayField(this.id, parsed, 'sourcesContent', (entry) =>
        entry !== null && typeof entry !== 'string'
          ? `must be a string or null, got ${typeof entry}`
          : null,
      ),
    );

    // names: array of strings
    diagnostics.push(
      ...validateArrayField(this.id, parsed, 'names', (entry) =>
        typeof entry !== 'string' ? `must be a string, got ${typeof entry}` : null,
      ),
    );

    // ignoreList: array of non-negative integers
    diagnostics.push(
      ...validateArrayField(this.id, parsed, 'ignoreList', (entry) =>
        typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0
          ? `must be a non-negative integer, got ${JSON.stringify(entry)}`
          : null,
      ),
    );

    // mappings: string
    if ('mappings' in parsed && typeof parsed.mappings !== 'string') {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: `\`mappings\` must be a string, got ${typeof parsed.mappings}`,
      });
    }

    // file: string (optional)
    if ('file' in parsed && typeof parsed.file !== 'string') {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: `\`file\` must be a string, got ${typeof parsed.file}`,
      });
    }

    // sourceRoot: string (optional)
    if ('sourceRoot' in parsed && typeof parsed.sourceRoot !== 'string') {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: `\`sourceRoot\` must be a string, got ${typeof parsed.sourceRoot}`,
      });
    }

    return diagnostics;
  },
};
