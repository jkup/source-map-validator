import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const columnOrderingRule: Rule = {
  id: 'column-ordering',
  description: 'Generated columns should be strictly ascending within each line',
  severity: 'warning',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap) return [];

    const diagnostics: Diagnostic[] = [];

    for (let lineIdx = 0; lineIdx < context.sourceMap.mappings.length; lineIdx++) {
      const line = context.sourceMap.mappings[lineIdx]!;
      for (let i = 1; i < line.length; i++) {
        const current = line[i]!;
        const previous = line[i - 1]!;
        if (current.generatedColumn <= previous.generatedColumn) {
          diagnostics.push({
            rule: this.id,
            severity: 'warning',
            message: `Generated columns are not ascending on line ${lineIdx + 1}: column ${current.generatedColumn} follows column ${previous.generatedColumn}`,
            location: {
              generatedLine: lineIdx + 1,
              generatedColumn: current.generatedColumn,
            },
          });
        }
      }
    }

    return diagnostics;
  },
};
