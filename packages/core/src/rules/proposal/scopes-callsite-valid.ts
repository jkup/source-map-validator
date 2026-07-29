import type {
  Rule,
  RuleContext,
  Diagnostic,
  DecodedOriginalScope,
  DecodedGeneratedRange,
} from '../../types.js';

function flattenScopes(scopes: (DecodedOriginalScope | null)[]): DecodedOriginalScope[] {
  const flat: DecodedOriginalScope[] = [];
  function walk(scope: DecodedOriginalScope): void {
    flat.push(scope);
    for (const child of scope.children) {
      walk(child);
    }
  }
  for (const root of scopes) {
    if (root) walk(root);
  }
  return flat;
}

export const scopesCallsiteValidRule: Rule = {
  id: 'scopes-callsite-valid',
  description:
    'Ranges with a callsite must have a definition that is a stack frame, and must not themselves be a stack frame',
  severity: 'error',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes) return [];

    const diagnostics: Diagnostic[] = [];
    const flatScopes = flattenScopes(context.decodedScopes.originalScopes);
    const { generatedRanges } = context.decodedScopes;

    for (let i = 0; i < generatedRanges.length; i++) {
      checkCallsite(generatedRanges[i]!, `generatedRanges[${i}]`, flatScopes, diagnostics, this.id);
    }

    return diagnostics;
  },
};

function checkCallsite(
  range: DecodedGeneratedRange,
  path: string,
  flatScopes: DecodedOriginalScope[],
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (range.callsite) {
    if (range.definition === undefined) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `${path} has a callsite but no definition`,
      });
    } else if (range.definition < flatScopes.length) {
      const scope = flatScopes[range.definition]!;
      if (!scope.isStackFrame) {
        diagnostics.push({
          rule: ruleId,
          severity: 'error',
          message: `${path} has a callsite but its definition is not a stack frame`,
        });
      }
    }

    if (range.isStackFrame) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `${path} has a callsite but is itself marked as a stack frame (StackFrameType must be none)`,
      });
    }
  }

  for (let i = 0; i < range.children.length; i++) {
    checkCallsite(range.children[i]!, `${path}.children[${i}]`, flatScopes, diagnostics, ruleId);
  }
}
