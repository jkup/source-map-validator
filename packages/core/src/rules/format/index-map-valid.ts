import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

export const indexMapValidRule: Rule = {
  id: 'index-map-valid',
  description:
    'Index map sections must be sorted, non-overlapping, and mutually exclusive with `mappings`',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    const diagnostics: Diagnostic[] = [];
    const hasSections = 'sections' in parsed;
    const hasMappings = 'mappings' in parsed;
    const hasSources = 'sources' in parsed;

    // sections and mappings/sources are mutually exclusive
    if (hasSections && hasMappings) {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: 'Source map has both `sections` and `mappings` — these are mutually exclusive',
      });
    }

    if (hasSections && hasSources) {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: 'Source map has both `sections` and `sources` — these are mutually exclusive',
      });
    }

    if (!hasSections) return diagnostics;

    if (!Array.isArray(parsed.sections)) {
      diagnostics.push({
        rule: this.id,
        severity: 'error',
        message: '`sections` must be an array',
      });
      return diagnostics;
    }

    const sections = parsed.sections as Array<Record<string, unknown>>;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // Validate section structure
      if (!section || typeof section !== 'object') {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: `\`sections[${i}]\` is not an object`,
        });
        continue;
      }

      if (!section.offset || typeof section.offset !== 'object') {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: `\`sections[${i}].offset\` is missing or not an object`,
        });
        continue;
      }

      const offset = section.offset as Record<string, unknown>;
      if (typeof offset.line !== 'number' || typeof offset.column !== 'number') {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: `\`sections[${i}].offset\` must have numeric \`line\` and \`column\` fields`,
        });
        continue;
      }

      if (offset.line < 0 || offset.column < 0) {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: `\`sections[${i}].offset\` has negative values: line=${offset.line}, column=${offset.column}`,
        });
      }

      if (!section.map || typeof section.map !== 'object') {
        diagnostics.push({
          rule: this.id,
          severity: 'error',
          message: `\`sections[${i}].map\` is missing or not an object`,
        });
      }

      // Check ordering (must be ascending)
      if (i > 0) {
        const prev = sections[i - 1];
        if (prev?.offset && typeof prev.offset === 'object') {
          const prevOffset = prev.offset as Record<string, unknown>;
          const prevLine = prevOffset.line as number;
          const prevCol = prevOffset.column as number;
          const curLine = offset.line as number;
          const curCol = offset.column as number;

          if (curLine < prevLine || (curLine === prevLine && curCol <= prevCol)) {
            diagnostics.push({
              rule: this.id,
              severity: 'error',
              message: `\`sections[${i}]\` offset (${curLine}:${curCol}) is not after \`sections[${i - 1}]\` offset (${prevLine}:${prevCol}) — sections must be sorted by position`,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
