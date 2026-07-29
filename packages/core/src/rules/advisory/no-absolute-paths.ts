import type { Rule, RuleContext, Diagnostic } from '../../types.js';
import { checkSourcePaths } from '../../rule-utils.js';

const ABSOLUTE_PATH_RE = /^(?:[A-Za-z]:\\|\/(?:Users|home|root|var|tmp|opt|usr)\/)/;

export const noAbsolutePathsRule: Rule = {
  id: 'no-absolute-paths',
  description: 'Source paths should be relative, not absolute filesystem paths',
  severity: 'warning',
  level: 4,

  check(context: RuleContext): Diagnostic[] {
    return checkSourcePaths(
      this.id,
      context,
      (path) => ABSOLUTE_PATH_RE.test(path),
      (path, location) =>
        `${location} uses an absolute path "${path}" — this makes the source map non-portable across machines`,
    );
  },
};
