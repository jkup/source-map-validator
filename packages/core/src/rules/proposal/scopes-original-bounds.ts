import type {
  Rule,
  RuleContext,
  Diagnostic,
  DecodedOriginalScope,
  DecodedGeneratedRange,
} from '../../types.js';
import { buildSourceLines } from '../../utf16.js';

export const scopesOriginalBoundsRule: Rule = {
  id: 'scopes-original-bounds',
  description: 'Original scope positions and callsite positions must be within source file bounds',
  severity: 'error',
  level: 3,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes || !context.sourceMap) return [];

    const diagnostics: Diagnostic[] = [];
    const sourceLines = buildSourceLines(
      context.sourceMap.sources,
      context.sourceMap.sourcesContent,
      context.originalSources,
    );
    const { originalScopes, generatedRanges } = context.decodedScopes;

    for (let i = 0; i < originalScopes.length; i++) {
      const scope = originalScopes[i];
      if (!scope) continue;
      const lines = sourceLines.get(i);
      if (!lines) continue;
      checkScopeBounds(scope, `originalScopes[${i}]`, lines, diagnostics, this.id);
    }

    for (let i = 0; i < generatedRanges.length; i++) {
      checkCallsiteBounds(
        generatedRanges[i]!,
        `generatedRanges[${i}]`,
        sourceLines,
        context.sourceMap.sources,
        diagnostics,
        this.id,
      );
    }

    return diagnostics;
  },
};

function checkScopeBounds(
  scope: DecodedOriginalScope,
  path: string,
  lines: string[],
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  checkPosition(scope.start, `${path}.start`, lines, diagnostics, ruleId);
  checkPosition(scope.end, `${path}.end`, lines, diagnostics, ruleId);

  for (let i = 0; i < scope.children.length; i++) {
    checkScopeBounds(scope.children[i]!, `${path}.children[${i}]`, lines, diagnostics, ruleId);
  }
}

function checkCallsiteBounds(
  range: DecodedGeneratedRange,
  path: string,
  sourceLines: Map<number, string[]>,
  sources: (string | null)[],
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (range.callsite) {
    const lines = sourceLines.get(range.callsite.sourceIndex);
    if (lines) {
      checkPosition(
        { line: range.callsite.line, column: range.callsite.column },
        `${path}.callsite`,
        lines,
        diagnostics,
        ruleId,
      );
    }
  }

  for (let i = 0; i < range.children.length; i++) {
    checkCallsiteBounds(
      range.children[i]!,
      `${path}.children[${i}]`,
      sourceLines,
      sources,
      diagnostics,
      ruleId,
    );
  }
}

function checkPosition(
  pos: { line: number; column: number },
  label: string,
  lines: string[],
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  if (pos.line >= lines.length) {
    diagnostics.push({
      rule: ruleId,
      severity: 'error',
      message: `${label} references line ${pos.line} but the source file only has ${lines.length} lines`,
    });
    return;
  }

  const lineContent = lines[pos.line]!;
  if (pos.column > lineContent.length) {
    diagnostics.push({
      rule: ruleId,
      severity: 'error',
      message: `${label} references column ${pos.column} on line ${pos.line} but the line is only ${lineContent.length} code units long`,
    });
  }
}
