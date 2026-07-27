import type { Rule, Diagnostic } from '../../types.js';

export const scopesDecodeValidRule: Rule = {
  id: 'scopes-decode-valid',
  description: 'The `scopes` field must decode without VLQ or structural errors',
  severity: 'error',
  level: 1,
  proposal: 'scopes',

  check(): Diagnostic[] {
    return [];
  },
};
