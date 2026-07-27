import type { Rule, RuleContext, Diagnostic, DecodedGeneratedRange } from '../../types.js';

export const scopesRangeFlagsValidRule: Rule = {
  id: 'scopes-range-flags-valid',
  description: 'Generated range flag combinations must be valid',
  severity: 'warning',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes) return [];

    const diagnostics: Diagnostic[] = [];
    const { generatedRanges } = context.decodedScopes;

    for (let i = 0; i < generatedRanges.length; i++) {
      checkFlags(generatedRanges[i]!, `generatedRanges[${i}]`, diagnostics, this.id);
    }

    return diagnostics;
  },
};

function checkFlags(
  range: DecodedGeneratedRange,
  path: string,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (range.isHidden && !range.isStackFrame) {
    diagnostics.push({
      rule: ruleId,
      severity: 'warning',
      message: `${path} has IS_HIDDEN flag (0x8) set without IS_STACK_FRAME (0x4)`,
    });
  }

  for (let i = 0; i < range.children.length; i++) {
    checkFlags(range.children[i]!, `${path}.children[${i}]`, diagnostics, ruleId);
  }
}
