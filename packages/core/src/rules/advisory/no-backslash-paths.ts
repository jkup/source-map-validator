import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { checkSourcePaths } from '../../rule-utils.js';

export const noBackslashPathsRule: Rule = {
  id: 'no-backslash-paths',
  description: 'Source paths should use forward slashes, not backslashes',
  severity: 'warning',
  level: 4,

  check(context: RuleContext): Diagnostic[] {
    return checkSourcePaths(
      this.id,
      context,
      (path) => path.includes('\\'),
      (path, location) =>
        `${location} uses backslashes "${path}" — URLs should use forward slashes`,
    );
  },
};
