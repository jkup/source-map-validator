import type { Rule, RuleContext, Diagnostic } from '../../types.js';

const THIRD_PARTY_PATTERNS = [
  /node_modules\//,
  /webpack\/runtime/,
  /webpack\/bootstrap/,
  /webpack-internal:\/\//,
  /\bpolyfill/i,
  /\.min\.js$/,
];

export const hasIgnoreListRule: Rule = {
  id: 'has-ignore-list',
  description: 'Source map should include `ignoreList` when sources contain third-party code',
  severity: 'info',
  level: 4,

  check(context: RuleContext): Diagnostic[] {
    if (!context.sourceMap) return [];

    const { sources, ignoreList } = context.sourceMap;

    // Find sources that look like third-party code
    const thirdPartySources: string[] = [];
    for (const source of sources) {
      if (source) {
        for (const pattern of THIRD_PARTY_PATTERNS) {
          if (pattern.test(source)) {
            thirdPartySources.push(source);
            break;
          }
        }
      }
    }

    if (thirdPartySources.length === 0) return [];

    if (!ignoreList || ignoreList.length === 0) {
      return [
        {
          rule: this.id,
          severity: 'info',
          message: `Source map has no \`ignoreList\` but contains ${thirdPartySources.length} source(s) that look like third-party code (e.g., "${thirdPartySources[0]}"). Adding an \`ignoreList\` helps debuggers hide framework internals.`,
        },
      ];
    }

    return [];
  },
};
