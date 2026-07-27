import type {
  Rule,
  RuleContext,
  Diagnostic,
  DecodedOriginalScope,
  DecodedGeneratedRange,
} from '../../types.js';

function countScopes(scopes: (DecodedOriginalScope | null)[]): number {
  let count = 0;
  function walk(scope: DecodedOriginalScope): void {
    count++;
    for (const child of scope.children) {
      walk(child);
    }
  }
  for (const root of scopes) {
    if (root) walk(root);
  }
  return count;
}

export const scopesDefinitionBoundsRule: Rule = {
  id: 'scopes-definition-bounds',
  description: 'Generated range definition indices must reference valid original scopes',
  severity: 'error',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes) return [];

    const diagnostics: Diagnostic[] = [];
    const totalScopes = countScopes(context.decodedScopes.originalScopes);
    const { generatedRanges } = context.decodedScopes;

    for (let i = 0; i < generatedRanges.length; i++) {
      checkDefinition(
        generatedRanges[i]!,
        `generatedRanges[${i}]`,
        totalScopes,
        diagnostics,
        this.id,
      );
    }

    return diagnostics;
  },
};

function checkDefinition(
  range: DecodedGeneratedRange,
  path: string,
  totalScopes: number,
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (range.definition !== undefined && range.definition >= totalScopes) {
    diagnostics.push({
      rule: ruleId,
      severity: 'error',
      message: `${path} definition index ${range.definition} exceeds total original scopes count (${totalScopes})`,
    });
  }

  for (let i = 0; i < range.children.length; i++) {
    checkDefinition(range.children[i]!, `${path}.children[${i}]`, totalScopes, diagnostics, ruleId);
  }
}
