// ---------------------------------------------------------------------------
// Diagnostic types
// ---------------------------------------------------------------------------

export type Severity = 'error' | 'warning' | 'info';

export interface DiagnosticLocation {
  /** 1-based generated line (for human display) */
  generatedLine?: number;
  /** 0-based generated column (UTF-16 code units) */
  generatedColumn?: number;
  /** Source file path/URL */
  originalSource?: string;
  /** 1-based original line */
  originalLine?: number;
  /** 0-based original column */
  originalColumn?: number;
  /** Index within the decoded mappings array */
  mappingIndex?: number;
}

export interface Diagnostic {
  rule: string;
  severity: Severity;
  message: string;
  location?: DiagnosticLocation;
}

// ---------------------------------------------------------------------------
// Decoded source map types
// ---------------------------------------------------------------------------

/**
 * A single decoded mapping segment with absolute positions.
 * Fields 2-5 are only present for segments with 4 or 5 VLQ fields.
 */
export interface DecodedSegment {
  /** 0-based column in generated file (UTF-16 code units) */
  generatedColumn: number;
  /** Index into `sources`, if present */
  sourceIndex?: number;
  /** 0-based line in original source, if present */
  originalLine?: number;
  /** 0-based column in original source (UTF-16 code units), if present */
  originalColumn?: number;
  /** Index into `names`, if present */
  nameIndex?: number;
}

/** One line of the generated file: an array of segments */
export type DecodedLine = DecodedSegment[];

/** Full decoded mappings: one entry per generated line */
export type DecodedMappings = DecodedLine[];

export interface DecodedSourceMap {
  version: number;
  file?: string;
  sourceRoot?: string;
  sources: (string | null)[];
  sourcesContent?: (string | null)[];
  names?: string[];
  mappings: DecodedMappings;
  ignoreList?: number[];
  /** Raw extension fields (keys starting with x_) */
  extensions: Record<string, unknown>;
}

export interface IndexMapSection {
  offset: { line: number; column: number };
  map: DecodedSourceMap;
}

export interface DecodedIndexMap {
  version: number;
  file?: string;
  sections: IndexMapSection[];
}

// ---------------------------------------------------------------------------
// Decoded scopes types (ECMA-426 scopes proposal)
// ---------------------------------------------------------------------------

export interface DecodedOriginalScope {
  start: { line: number; column: number };
  end: { line: number; column: number };
  name?: string;
  kind?: string;
  isStackFrame: boolean;
  variables: string[];
  children: DecodedOriginalScope[];
}

export interface DecodedBindingRange {
  from: { line: number; column: number };
  expression?: string;
}

export type DecodedBinding =
  | { type: 'simple'; expression?: string }
  | { type: 'subrange'; variableIndex: number; ranges: DecodedBindingRange[] };

export interface DecodedGeneratedRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
  isStackFrame: boolean;
  isHidden: boolean;
  definition?: number;
  callsite?: { sourceIndex: number; line: number; column: number };
  bindings: DecodedBinding[];
  children: DecodedGeneratedRange[];
}

export interface DecodedScopes {
  originalScopes: (DecodedOriginalScope | null)[];
  generatedRanges: DecodedGeneratedRange[];
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

export type ValidationLevel = 1 | 2 | 3 | 4;

export interface ValidateOptions {
  /** Raw source map JSON string */
  sourceMap: string;
  /** Raw generated file content (enables Level 2 checks) */
  generatedSource?: string;
  /** Type of generated file — 'wasm' treats content as flat bytes with no line structure */
  generatedFileType?: 'text' | 'wasm';
  /** Original source file contents keyed by path (enables Level 3 checks) */
  originalSources?: Record<string, string>;
  /** Override individual rules: rule id → enabled */
  rules?: Record<string, boolean>;
  /** Preset configuration */
  preset?: 'strict' | 'ci' | 'minimal';
  /** Enable rules gated behind proposals (e.g. ['scopes']) */
  proposals?: string[];
}

export interface SourceMapStats {
  mappingCount: number;
  sourceCount: number;
  nameCount: number;
  hasSourcesContent: boolean;
  hasIgnoreList: boolean;
  hasScopes: boolean;
  isIndexMap: boolean;
  extensions: string[];
}

export interface CoverageLineReport {
  /** 1-based line number */
  line: number;
  /** 0.0 to 1.0 coverage ratio */
  coverage: number;
}

export interface UnmappedRange {
  /** 1-based line */
  line: number;
  /** 0-based start column */
  startCol: number;
  /** 0-based end column (exclusive) */
  endCol: number;
}

export interface CoverageReport {
  totalCharacters: number;
  mappedCharacters: number;
  coveragePercent: number;
  perLine: CoverageLineReport[];
  unmappedRanges: UnmappedRange[];
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
  errors: Diagnostic[];
  warnings: Diagnostic[];
  infos: Diagnostic[];
  stats: SourceMapStats;
  coverage?: CoverageReport;
}

// ---------------------------------------------------------------------------
// Rule types
// ---------------------------------------------------------------------------

export interface RuleContext {
  /** Raw JSON string input */
  rawJson: string;
  /** Parsed JSON value (unknown shape — rules do their own checks) */
  parsed: unknown;
  /** Decoded source map, if parsing succeeded. Null if JSON/structure was invalid. */
  sourceMap: DecodedSourceMap | null;
  /** Generated file content, if provided */
  generatedSource?: string;
  /** Type of generated file — 'wasm' treats content as flat bytes with no line structure */
  generatedFileType?: 'text' | 'wasm';
  /** Original sources map, if provided */
  originalSources?: Record<string, string>;
  /** Decoded scopes data, if the scopes proposal is enabled and the field exists */
  decodedScopes?: DecodedScopes;
}

export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  level: ValidationLevel;
  /** If set, this rule is gated behind a proposal flag and disabled by default. */
  proposal?: string;
  check(context: RuleContext): Diagnostic[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The set of field names recognized by the ECMA-426 source map specification.
 * Used to identify extension/unknown fields — keep this in sync with the spec.
 */
export const KNOWN_FIELDS = new Set([
  'version',
  'file',
  'sourceRoot',
  'sources',
  'sourcesContent',
  'names',
  'mappings',
  'ignoreList',
  'sections',
  'scopes',
  'x_google_ignoreList',
]);

// ---------------------------------------------------------------------------
// Rule helpers
// ---------------------------------------------------------------------------

/**
 * Type-safe narrowing of `context.parsed` to a plain object.
 * Returns null if parsed is null, not an object, or an array.
 */
export function parsedObject(context: RuleContext): Record<string, unknown> | null {
  const p = context.parsed;
  if (p === null || p === undefined || typeof p !== 'object' || Array.isArray(p)) {
    return null;
  }
  return p as Record<string, unknown>;
}
