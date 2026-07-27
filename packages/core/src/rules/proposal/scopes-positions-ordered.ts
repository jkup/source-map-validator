import type {
  Rule,
  RuleContext,
  Diagnostic,
  DecodedOriginalScope,
  DecodedGeneratedRange,
} from '../../types.js';

export const scopesPositionsOrderedRule: Rule = {
  id: 'scopes-positions-ordered',
  description: 'Scope and range start positions must precede their end positions',
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
      checkScopeOrdering(scope, `originalScopes[${i}]`, diagnostics, this.id);
    }

    for (let i = 0; i < generatedRanges.length; i++) {
      checkRangeOrdering(generatedRanges[i]!, `generatedRanges[${i}]`, diagnostics, this.id);
    }

    return diagnostics;
  },
};

function posBefore(
  a: { line: number; column: number },
  b: { line: number; column: number },
): boolean {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

function posEqual(
  a: { line: number; column: number },
  b: { line: number; column: number },
): boolean {
  return a.line === b.line && a.column === b.column;
}

function fmtPos(p: { line: number; column: number }): string {
  return `${p.line}:${p.column}`;
}

function checkScopeOrdering(
  scope: DecodedOriginalScope,
  path: string,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (posBefore(scope.end, scope.start) || posEqual(scope.end, scope.start)) {
    diagnostics.push({
      rule: ruleId,
      severity: 'error',
      message: `${path} end (${fmtPos(scope.end)}) is not after start (${fmtPos(scope.start)})`,
    });
  }

  for (let i = 0; i < scope.children.length; i++) {
    checkScopeOrdering(scope.children[i]!, `${path}.children[${i}]`, diagnostics, ruleId);
  }
}

function checkRangeOrdering(
  range: DecodedGeneratedRange,
  path: string,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (posBefore(range.end, range.start) || posEqual(range.end, range.start)) {
    diagnostics.push({
      rule: ruleId,
      severity: 'error',
      message: `${path} end (${fmtPos(range.end)}) is not after start (${fmtPos(range.start)})`,
    });
  }

  for (let i = 0; i < range.children.length; i++) {
    checkRangeOrdering(range.children[i]!, `${path}.children[${i}]`, diagnostics, ruleId);
  }
}
