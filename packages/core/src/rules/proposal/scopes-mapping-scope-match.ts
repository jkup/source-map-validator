import type {
  Rule,
  RuleContext,
  Diagnostic,
  DecodedOriginalScope,
  DecodedGeneratedRange,
} from '../../types.js';
import { forEachSegment, segmentLocation } from '../../rule-utils.js';

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

function posContains(
  start: { line: number; column: number },
  end: { line: number; column: number },
  line: number,
  col: number,
): boolean {
  if (line < start.line || line > end.line) return false;
  if (line === start.line && col < start.column) return false;
  if (line === end.line && col >= end.column) return false;
  return true;
}

function findInnermostRange(
  ranges: DecodedGeneratedRange[],
  line: number,
  col: number,
): DecodedGeneratedRange | null {
  for (const range of ranges) {
    if (posContains(range.start, range.end, line, col)) {
      const deeper = findInnermostRange(range.children, line, col);
      return deeper ?? range;
    }
  }
  return null;
}

function findScopeChain(
  root: DecodedOriginalScope,
  line: number,
  col: number,
): DecodedOriginalScope[] | null {
  if (!posContains(root.start, root.end, line, col)) return null;
  const chain = [root];
  for (const child of root.children) {
    const childChain = findScopeChain(child, line, col);
    if (childChain) {
      chain.push(...childChain);
      break;
    }
  }
  return chain;
}

export const scopesMappingScopeMatchRule: Rule = {
  id: 'scopes-mapping-scope-match',
  description:
    "Mappings inside a generated range must fall within the range's definition scope in the original source",
  severity: 'warning',
  level: 1,
  proposal: 'scopes',

  check(context: RuleContext): Diagnostic[] {
    if (!context.decodedScopes || !context.sourceMap) return [];

    const diagnostics: Diagnostic[] = [];
    const flatScopes = flattenScopes(context.decodedScopes.originalScopes);
    const { originalScopes, generatedRanges } = context.decodedScopes;

    forEachSegment(context.sourceMap.mappings, (info) => {
      const { segment, lineIdx } = info;
      if (segment.sourceIndex === undefined || segment.originalLine === undefined || segment.originalColumn === undefined) {
        return;
      }

      const range = findInnermostRange(generatedRanges, lineIdx, segment.generatedColumn);
      if (!range || range.definition === undefined) return;
      if (range.definition >= flatScopes.length) return;

      const defScope = flatScopes[range.definition]!;
      const sourceIdx = segment.sourceIndex;
      if (sourceIdx >= originalScopes.length) return;

      const rootScope = originalScopes[sourceIdx];
      if (!rootScope) return;

      const chain = findScopeChain(rootScope, segment.originalLine, segment.originalColumn);
      if (!chain || !chain.includes(defScope)) {
        diagnostics.push({
          rule: this.id,
          severity: 'warning',
          message: `Mapping at ${lineIdx + 1}:${segment.generatedColumn} points to original ${segment.originalLine + 1}:${segment.originalColumn} which is outside the generated range's definition scope`,
          location: {
            ...segmentLocation(info),
            originalLine: segment.originalLine + 1,
            originalColumn: segment.originalColumn,
          },
        });
      }
    });

    return diagnostics;
  },
};
