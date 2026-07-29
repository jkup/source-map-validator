import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const sourcesContentConsistencyRule: Rule = {
  id: 'sources-content-consistency',
  description:
    'When both sourcesContent and original source files are available, they should match',
  severity: 'warning',
  level: 3,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap || !context.originalSources) return [];

    const { sources, sourcesContent } = context.sourceMap;
    if (!sourcesContent) return [];

    const diagnostics: Diagnostic[] = [];

    for (let i = 0; i < sources.length; i++) {
      const sourcePath = sources[i];
      if (!sourcePath) continue;

      const embeddedContent = sourcesContent[i] ?? null;
      const fileContent = context.originalSources[sourcePath];

      if (embeddedContent !== null && fileContent !== undefined) {
        if (embeddedContent !== fileContent) {
          // Check if it's a whitespace/line-ending difference
          const normalizedEmbedded = embeddedContent.replace(/\r\n/g, '\n');
          const normalizedFile = fileContent.replace(/\r\n/g, '\n');

          if (normalizedEmbedded === normalizedFile) {
            diagnostics.push({
              rule: this.id,
              severity: 'info',
              message: `\`sourcesContent[${i}]\` for "${sourcePath}" differs from the file on disk only in line endings`,
            });
          } else {
            diagnostics.push({
              rule: this.id,
              severity: 'warning',
              message: `\`sourcesContent[${i}]\` for "${sourcePath}" does not match the file on disk — the source map may be stale`,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
