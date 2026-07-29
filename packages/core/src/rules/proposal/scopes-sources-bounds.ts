import type { Rule, RuleContext, Diagnostic, DecodedGeneratedRange } from '../../types.js';

export const scopesSourcesBoundsRule: Rule = {
  id: 'scopes-sources-bounds',
  description:
    'Scope tree count must not exceed sources count, and callsite source indices must be valid',
  severity: 'error',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes || !context.sourceMap) return [];

    const diagnostics: Diagnostic[] = [];
    const sourceCount = context.sourceMap.sources.length;
    const { originalScopes, generatedRanges } = context.decodedScopes;

    if (originalScopes.length > sourceCount) {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: `There are ${originalScopes.length} original scope trees but only ${sourceCount} sources`,
      });
    }

    for (let i = 0; i < generatedRanges.length; i++) {
      checkCallsiteSources(
        generatedRanges[i]!,
        `generatedRanges[${i}]`,
        sourceCount,
        diagnostics,
        this.id,
      );
    }

    return diagnostics;
  },
};

function checkCallsiteSources(
  range: DecodedGeneratedRange,
  path: string,
  sourceCount: number,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (range.callsite && range.callsite.sourceIndex >= sourceCount) {
    diagnostics.push({
      rule: ruleId,
      severity: 'error',
      message: `${path} callsite references source index ${range.callsite.sourceIndex} but there are only ${sourceCount} sources`,
    });
  }

  for (let i = 0; i < range.children.length; i++) {
    checkCallsiteSources(
      range.children[i]!,
      `${path}.children[${i}]`,
      sourceCount,
      diagnostics,
      ruleId,
    );
  }
}
