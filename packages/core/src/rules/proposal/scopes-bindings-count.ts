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

export const scopesBindingsCountRule: Rule = {
  id: 'scopes-bindings-count',
  description:
    'Generated range bindings count must match the variable count of the referenced original scope',
  severity: 'warning',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes) return [];

    const diagnostics: Diagnostic[] = [];
    const flatScopes = flattenScopes(context.decodedScopes.originalScopes);
    const { generatedRanges } = context.decodedScopes;

    for (let i = 0; i < generatedRanges.length; i++) {
      checkBindingsCount(
        generatedRanges[i]!,
        `generatedRanges[${i}]`,
        flatScopes,
        diagnostics,
        this.id,
      );
    }

    return diagnostics;
  },
};

function checkBindingsCount(
  range: DecodedGeneratedRange,
  path: string,
  flatScopes: DecodedOriginalScope[],
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (range.definition !== undefined && range.definition < flatScopes.length) {
    const scope = flatScopes[range.definition]!;
    const simpleBindings = range.bindings.filter((b) => b.type === 'simple');
    if (simpleBindings.length > 0 && simpleBindings.length !== scope.variables.length) {
      diagnostics.push({
        rule: ruleId,
        severity: 'warning',
        message: `${path} has ${simpleBindings.length} bindings but its definition scope has ${scope.variables.length} variables`,
      });
    }
  }

  for (let i = 0; i < range.children.length; i++) {
    checkBindingsCount(
      range.children[i]!,
      `${path}.children[${i}]`,
      flatScopes,
      diagnostics,
      ruleId,
    );
  }
}
