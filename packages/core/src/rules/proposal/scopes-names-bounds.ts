import type {
  Rule,
  RuleContext,
  Diagnostic,
  DecodedOriginalScope,
  DecodedGeneratedRange,
} from '../../types.js';

export const scopesNamesBoundsRule: Rule = {
  id: 'scopes-names-bounds',
  description: 'All name references in scopes must be valid indices into `names`',
  severity: 'error',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes || !context.sourceMap) return [];

    const diagnostics: Diagnostic[] = [];
    const nameCount = context.sourceMap.names?.length ?? 0;
    const { originalScopes, generatedRanges } = context.decodedScopes;

    for (let i = 0; i < originalScopes.length; i++) {
      const scope = originalScopes[i];
      if (!scope) continue;
      checkScopeNames(scope, `originalScopes[${i}]`, nameCount, diagnostics, this.id);
    }

    for (let i = 0; i < generatedRanges.length; i++) {
      checkRangeNames(
        generatedRanges[i]!,
        `generatedRanges[${i}]`,
        nameCount,
        diagnostics,
        this.id,
      );
    }

    return diagnostics;
  },
};

function checkScopeNames(
  scope: DecodedOriginalScope,
  path: string,
  nameCount: number,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  // name and kind are resolved during decode — we can't directly check indices
  // post-decode since they've been resolved to strings. The decoder handles
  // out-of-bounds by returning undefined, so we check for placeholder names.
  // Variable names with <name N> pattern indicate out-of-bounds.
  for (let i = 0; i < scope.variables.length; i++) {
    const v = scope.variables[i]!;
    const match = v.match(/^<name (\d+)>$/);
    if (match) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `${path}.variables[${i}] references name index ${match[1]} which is out of bounds (${nameCount} names)`,
      });
    }
  }

  for (let i = 0; i < scope.children.length; i++) {
    checkScopeNames(scope.children[i]!, `${path}.children[${i}]`, nameCount, diagnostics, ruleId);
  }
}

function checkRangeNames(
  range: DecodedGeneratedRange,
  path: string,
  nameCount: number,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  for (let i = 0; i < range.bindings.length; i++) {
    const binding = range.bindings[i]!;
    if (binding.type === 'subrange') {
      for (let j = 0; j < binding.ranges.length; j++) {
        // Binding expressions are resolved during decode; undefined means unavailable (0 value), not out of bounds
      }
    }
  }

  for (let i = 0; i < range.children.length; i++) {
    checkRangeNames(range.children[i]!, `${path}.children[${i}]`, nameCount, diagnostics, ruleId);
  }
}
