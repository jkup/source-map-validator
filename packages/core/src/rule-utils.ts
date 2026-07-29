import type {
  DecodedMappings,
  DecodedSegment,
  Diagnostic,
  DiagnosticLocation,
  RuleContext,
} from './types.js';

export interface SegmentInfo {
  segment: DecodedSegment;
  lineIdx: number;
  mappingIndex: number;
}

/**
 * Iterate over every segment in a decoded mappings array, providing
 * the segment, its generated line index (0-based), and its overall
 * mapping index.
 */
export function forEachSegment(
  mappings: DecodedMappings,
  callback: (info: SegmentInfo) => void,
): void {
  let mappingIndex = 0;
  for (let lineIdx = 0; lineIdx < mappings.length; lineIdx++) {
    const line = mappings[lineIdx];
    if (!line) continue;
    for (const segment of line) {
      callback({ segment, lineIdx, mappingIndex });
      mappingIndex++;
    }
  }
}

/**
 * Validate that a parsed source map field is an array whose elements
 * each pass a type check. Returns diagnostics for the field not being
 * an array, or for individual elements that fail the check.
 *
 * @param ruleId - The rule ID for diagnostics
 * @param parsed - The parsed source map object
 * @param field - The field name to check
 * @param checkElement - Returns an error description if the element is invalid, or null if valid
 */
export function validateArrayField(
  ruleId: string,
  parsed: Record<string, unknown>,
  field: string,
  checkElement: (entry: unknown, index: number) => string | null,
): Diagnostic[] {
  if (!(field in parsed)) return [];

  const value = parsed[field];
  if (!Array.isArray(value)) {
    return [
      {
        rule: ruleId,
        severity: 'error',
        message: `\`${field}\` must be an array, got ${typeof value}`,
      },
    ];
  }

  const diagnostics: Diagnostic[] = [];
  for (let i = 0; i < value.length; i++) {
    const error = checkElement(value[i], i);
    if (error) {
      diagnostics.push({
        rule: ruleId,
        severity: 'error',
        message: `\`${field}[${i}]\` ${error}`,
      });
    }
  }
  return diagnostics;
}

/**
 * Build a base DiagnosticLocation from a SegmentInfo.
 * Callers needing original-side fields can spread extra properties on top.
 */
export function segmentLocation(info: SegmentInfo): DiagnosticLocation {
  return {
    generatedLine: info.lineIdx + 1,
    generatedColumn: info.segment.generatedColumn,
    mappingIndex: info.mappingIndex,
  };
}

/**
 * Check all source paths (and sourceRoot) against a predicate,
 * returning a warning diagnostic for each that matches.
 */
export function checkSourcePaths(
  ruleId: string,
  context: RuleContext,
  test: (path: string) => boolean,
  message: (path: string, location: string) => string,
): Diagnostic[] {
  if (!context.sourceMap) return [];

  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < context.sourceMap.sources.length; i++) {
    const source = context.sourceMap.sources[i];
    if (source && test(source)) {
      diagnostics.push({
        rule: ruleId,
        severity: 'warning',
        message: message(source, `\`sources[${i}]\``),
      });
    }
  }

  if (context.sourceMap.sourceRoot && test(context.sourceMap.sourceRoot)) {
    diagnostics.push({
      rule: ruleId,
      severity: 'warning',
      message: message(context.sourceMap.sourceRoot, '`sourceRoot`'),
    });
  }

  return diagnostics;
}
