import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const sourcesResolvableRule: Rule = {
  id: 'sources-resolvable',
  description:
    'Each source should be resolvable via `sourcesContent` or provided original source files',
  severity: 'warning',
  level: 4,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap) return [];

    const { sources, sourcesContent } = context.sourceMap;
    const diagnostics: Diagnostic[] = [];

    for (let i = 0; i < sources.length; i++) {
      const sourcePath = sources[i];
      if (sourcePath === null) continue;

      const hasEmbedded =
        sourcesContent !== undefined &&
        i < sourcesContent.length &&
        sourcesContent[i] !== null &&
        sourcesContent[i] !== undefined;

      const hasFile =
        context.originalSources !== undefined && sourcePath !== undefined && sourcePath in context.originalSources;

      if (!hasEmbedded && !hasFile) {
        diagnostics.push({
          rule: this.id,
          severity: 'warning',
          message: `Source "${sourcePath}" cannot be resolved — no sourcesContent entry and no original source file provided`,
        });
      }
    }

    return diagnostics;
  },
};
