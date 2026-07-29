import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const scopesTreeBalancedRule: Rule = {
  id: 'scopes-tree-balanced',
  description: 'Original scope and generated range trees must be properly nested',
  severity: 'error',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes) return [];

    const diagnostics: Diagnostic[] = [];
    const { originalScopes, generatedRanges } = context.decodedScopes;

    for (let i = 0; i < originalScopes.length; i++) {
      const scope = originalScopes[i];
      if (!scope) continue;
      checkScopeNesting(scope, `originalScopes[${i}]`, diagnostics, this.id);
    }

    for (let i = 0; i < generatedRanges.length; i++) {
      checkRangeNesting(generatedRanges[i]!, `generatedRanges[${i}]`, diagnostics, this.id);
    }

    return diagnostics;
  },
};

function checkScopeNesting(
  scope: NonNullable<ReturnType<typeof Object>>,
  path: string,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  const s = scope as import('../../types.js').DecodedOriginalScope;

  for (let i = 0; i < s.children.length; i++) {
    const child = s.children[i]!;
    const childPath = `${path}.children[${i}]`;

    if (posBefore(child.start, s.start)) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `${childPath} starts before its parent scope`,
      });
    }

    if (posBefore(s.end, child.end)) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `${childPath} ends after its parent scope`,
      });
    }

    if (i > 0) {
      const prev = s.children[i - 1]!;
      if (posBefore(child.start, prev.end)) {
        diagnostics.push({
          rule: ruleId,
          severity: 'error',
          message: `${childPath} overlaps with its preceding sibling`,
        });
      }
    }

    checkScopeNesting(child, childPath, diagnostics, ruleId);
  }
}

function checkRangeNesting(
  range: import('../../types.js').DecodedGeneratedRange,
  path: string,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  for (let i = 0; i < range.children.length; i++) {
    const child = range.children[i]!;
    const childPath = `${path}.children[${i}]`;

    if (posBefore(child.start, range.start)) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `${childPath} starts before its parent range`,
      });
    }

    if (posBefore(range.end, child.end)) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `${childPath} ends after its parent range`,
      });
    }

    if (i > 0) {
      const prev = range.children[i - 1]!;
      if (posBefore(child.start, prev.end)) {
        diagnostics.push({
          rule: ruleId,
          severity: 'error',
          message: `${childPath} overlaps with its preceding sibling`,
        });
      }
    }

    checkRangeNesting(child, childPath, diagnostics, ruleId);
  }
}

function posBefore(
  a: { line: number; column: number },
  b: { line: number; column: number },
): boolean {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}
