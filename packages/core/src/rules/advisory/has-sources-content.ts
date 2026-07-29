import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const hasSourcesContentRule: Rule = {
  id: 'has-sources-content',
  description: 'Source map should include `sourcesContent` so debuggers can display original code',
  severity: 'warning',
  level: 4,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap) return [];

    const { sourcesContent, sources } = context.sourceMap;

    if (!sourcesContent) {
      return [
        {
          rule: this.id,
          severity: 'warning',
          message:
            'Source map has no `sourcesContent` field — debuggers will not be able to display original source code unless the source files are accessible',
        },
      ];
    }

    const diagnostics: Diagnostic[] = [];
    let nullCount = 0;

    for (let i = 0; i < sourcesContent.length; i++) {
      if (sourcesContent[i] === null) {
        nullCount++;
      }
    }

    if (nullCount > 0) {
      diagnostics.push({
        rule: this.id,
        severity: 'info',
        message: `${nullCount} of ${sources.length} \`sourcesContent\` entries are null — those sources will not be available in debuggers unless the files are accessible`,
      });
    }

    return diagnostics;
  },
};
