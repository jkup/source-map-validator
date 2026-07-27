// Public API
export { validate } from './validator.js';
export { decodeMappings } from './decoder.js';
export { decodeScopes } from './scopes-decoder.js';
export { analyzeCoverage } from './coverage.js';
export { allRules, ruleById, allProposals } from './rules/index.js';
export { KNOWN_FIELDS } from './types.js';

export type {
  // Diagnostic types
  Severity,
  Diagnostic,
  DiagnosticLocation,

  // Source map types
  DecodedSegment,
  DecodedLine,
  DecodedMappings,
  DecodedSourceMap,
  IndexMapSection,
  DecodedIndexMap,

  // Scopes types (ECMA-426 proposal)
  DecodedScopes,
  DecodedOriginalScope,
  DecodedGeneratedRange,
  DecodedBinding,
  DecodedBindingRange,

  // Validation types
  ValidationLevel,
  ValidateOptions,
  ValidationResult,
  SourceMapStats,
  CoverageReport,
  CoverageLineReport,
  UnmappedRange,

  // Rule types
  Rule,
  RuleContext,
} from './types.js';
