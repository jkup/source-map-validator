import type { Rule, RuleContext, Diagnostic, DecodedGeneratedRange } from '../../types.js';
import { splitLines } from '../../utf16.js';

export const scopesRangeBoundsRule: Rule = {
  id: 'scopes-range-bounds',
  description: 'Generated range positions must be within the generated file bounds',
  severity: 'error',
  level: 2,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes || !context.generatedSource) return [];

    const diagnostics: Diagnostic[] = [];
    const lines = splitLines(context.generatedSource);
    const { generatedRanges } = context.decodedScopes;

    for (let i = 0; i < generatedRanges.length; i++) {
      checkRangeBounds(generatedRanges[i]!, `generatedRanges[${i}]`, lines, diagnostics, this.id);
    }

    return diagnostics;
  },
};

function checkRangeBounds(
  range: DecodedGeneratedRange,
  path: string,
  lines: string[],
  diagnostics: Diagnostic[],
  ruleId: string,
): void {
  checkPosition(range.start, `${path}.start`, lines, diagnostics, ruleId);
  checkPosition(range.end, `${path}.end`, lines, diagnostics, ruleId);

  for (let i = 0; i < range.children.length; i++) {
    checkRangeBounds(range.children[i]!, `${path}.children[${i}]`, lines, diagnostics, ruleId);
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
      message: `${label} references line ${pos.line} but the generated file only has ${lines.length} lines`,
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
