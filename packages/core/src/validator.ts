import {
  KNOWN_FIELDS,
  type ValidateOptions,
  type ValidationResult,
  type Diagnostic,
  type RuleContext,
  type DecodedSourceMap,
  type DecodedScopes,
  type SourceMapStats,
  type CoverageReport,
} from './types.js';
import { decodeMappings } from './decoder.js';
import { decodeScopes } from './scopes-decoder.js';
import { allRules } from './rules/index.js';
import { analyzeCoverage } from './coverage.js';

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS: Record<string, Record<string, boolean>> = {
  strict: {}, // all rules enabled, treated as errors
  ci: {}, // all rules enabled
  minimal: {
    // Only spec violations (Level 1), disable advisory
    'no-absolute-paths': false,
    'no-backslash-paths': false,
    'has-sources-content': false,
    'has-ignore-list': false,
    'deprecated-x-google': false,
    'extension-fields': false,
    'source-mapping-url': false,
    'token-matching': false,
    'sources-content-consistency': false,
    'sources-resolvable': false,
  },
};

// ---------------------------------------------------------------------------
// Parse + decode
// ---------------------------------------------------------------------------

function tryParse(rawJson: string): { parsed: unknown; error?: string } {
  try {
    // Strip )]}' prefix (HTTP protection for JSON hijacking)
    let json = rawJson;
    if (json.startsWith(")]}'\n")) {
      json = json.slice(5);
    } else if (json.startsWith(")]}'")) {
      json = json.slice(4);
    }

    // Strip BOM
    if (json.charCodeAt(0) === 0xfeff) {
      json = json.slice(1);
    }

    return { parsed: JSON.parse(json) };
  } catch (e) {
    return {
      parsed: null,
      error: e instanceof SyntaxError ? e.message : 'Invalid JSON',
    };
  }
}

/** Pre-decoded source map shape — all structural checks in one place. */
interface RawSourceMap {
  version: unknown;
  file?: string;
  sourceRoot?: string;
  sources: (string | null)[];
  sourcesContent?: (string | null)[];
  names?: string[];
  mappings: string;
  ignoreList?: number[];
}

/**
 * Narrow `unknown` JSON to a typed raw source map.
 * Returns null if the value is not a valid source map object.
 * Array element types (sources, names, etc.) are trusted per the spec
 * and validated by individual rules.
 */
function parseRawSourceMap(parsed: unknown): RawSourceMap | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.sources) || typeof obj.mappings !== 'string') {
    return null;
  }

  return {
    version: obj.version,
    file: typeof obj.file === 'string' ? obj.file : undefined,
    sourceRoot: typeof obj.sourceRoot === 'string' ? obj.sourceRoot : undefined,
    sources: obj.sources as (string | null)[],
    sourcesContent: Array.isArray(obj.sourcesContent)
      ? (obj.sourcesContent as (string | null)[])
      : undefined,
    names: Array.isArray(obj.names) ? (obj.names as string[]) : undefined,
    mappings: obj.mappings,
    ignoreList: Array.isArray(obj.ignoreList) ? (obj.ignoreList as number[]) : undefined,
  };
}

function decodeSourceMap(
  parsed: unknown,
): { sourceMap: DecodedSourceMap; decoderDiagnostics: Diagnostic[] } | null {
  const raw = parseRawSourceMap(parsed);
  if (!raw) return null;

  const { mappings: decodedMappings, diagnostics: decoderDiagnostics } = decodeMappings(
    raw.mappings,
  );

  // Collect extension fields
  const obj = parsed as Record<string, unknown>;
  const extensions: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!KNOWN_FIELDS.has(key)) {
      extensions[key] = obj[key];
    }
  }

  return {
    sourceMap: {
      version: raw.version as number,
      file: raw.file,
      sourceRoot: raw.sourceRoot,
      sources: raw.sources,
      sourcesContent: raw.sourcesContent,
      names: raw.names,
      mappings: decodedMappings,
      ignoreList: raw.ignoreList,
      extensions,
    },
    decoderDiagnostics,
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function computeStats(parsed: unknown, sourceMap: DecodedSourceMap | null): SourceMapStats {
  if (!sourceMap) {
    return {
      mappingCount: 0,
      sourceCount: 0,
      nameCount: 0,
      hasSourcesContent: false,
      hasIgnoreList: false,
      hasScopes: false,
      isIndexMap: false,
      extensions: [],
    };
  }

  let mappingCount = 0;
  for (const line of sourceMap.mappings) {
    mappingCount += line.length;
  }

  const isIndexMap =
    parsed !== null &&
    typeof parsed === 'object' &&
    'sections' in (parsed as Record<string, unknown>);

  return {
    mappingCount,
    sourceCount: sourceMap.sources.length,
    nameCount: sourceMap.names?.length ?? 0,
    hasSourcesContent: !!sourceMap.sourcesContent,
    hasIgnoreList: !!sourceMap.ignoreList,
    hasScopes:
      parsed !== null &&
      typeof parsed === 'object' &&
      'scopes' in (parsed as Record<string, unknown>),
    isIndexMap,
    extensions: Object.keys(sourceMap.extensions),
  };
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validate(options: ValidateOptions): ValidationResult {
  const { parsed } = tryParse(options.sourceMap);
  const decoded = decodeSourceMap(parsed);
  const sourceMap = decoded?.sourceMap ?? null;

  // Decode scopes if the proposal is enabled and the field exists
  let decodedScopes: DecodedScopes | undefined;
  let scopesDiagnostics: Diagnostic[] = [];
  if (
    options.proposals?.includes('scopes') &&
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    typeof (parsed as Record<string, unknown>).scopes === 'string'
  ) {
    const names = sourceMap?.names ?? [];
    const scopesResult = decodeScopes((parsed as Record<string, unknown>).scopes as string, names);
    decodedScopes = scopesResult.scopes;
    scopesDiagnostics = scopesResult.diagnostics;
  }

  // Build rule context
  const context: RuleContext = {
    rawJson: options.sourceMap,
    parsed,
    sourceMap,
    generatedSource: options.generatedSource,
    generatedFileType: options.generatedFileType,
    originalSources: options.originalSources,
    decodedScopes,
  };

  // Resolve rule overrides
  const ruleOverrides: Record<string, boolean> = {
    ...(options.preset ? (PRESETS[options.preset] ?? {}) : {}),
    ...(options.rules ?? {}),
  };

  // Determine max level based on available inputs
  let maxLevel = 1;
  if (options.generatedSource) maxLevel = 2;
  if (options.originalSources || sourceMap?.sourcesContent) maxLevel = 3;
  // Level 4 (advisory) always runs

  // Run rules
  const allDiagnostics: Diagnostic[] = [];

  // Add decoder diagnostics first (collected during decode, no double-decode)
  if (decoded) {
    allDiagnostics.push(...decoded.decoderDiagnostics);
  }
  allDiagnostics.push(...scopesDiagnostics);

  for (const rule of allRules) {
    // Check if rule is disabled
    if (ruleOverrides[rule.id] === false) continue;

    // Proposal rules are disabled unless explicitly opted in
    if (rule.proposal && !options.proposals?.includes(rule.proposal)) continue;

    // Check if rule level is applicable (but always run Level 4 advisory)
    if (rule.level !== 4 && rule.level > maxLevel) continue;

    try {
      const diagnostics = rule.check(context);

      // In strict preset, upgrade warnings to errors (without mutating originals)
      if (options.preset === 'strict') {
        allDiagnostics.push(
          ...diagnostics.map((d) =>
            d.severity === 'warning' ? { ...d, severity: 'error' as const } : d,
          ),
        );
      } else {
        allDiagnostics.push(...diagnostics);
      }
    } catch (e) {
      // Rule threw — this is a bug in the rule, surface it as an error
      const detail = e instanceof Error ? `: ${e.message}` : '';
      allDiagnostics.push({
        rule: rule.id,
        severity: 'error',
        message: `Rule "${rule.id}" threw an unexpected error during execution${detail}`,
      });
    }
  }

  // Recursive validation of index map sub-maps
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.sections)) {
      for (let i = 0; i < obj.sections.length; i++) {
        const section = (obj.sections as unknown[])[i];
        if (
          section &&
          typeof section === 'object' &&
          (section as Record<string, unknown>).map &&
          typeof (section as Record<string, unknown>).map === 'object'
        ) {
          const subMapJson = JSON.stringify((section as Record<string, unknown>).map);
          const subResult = validate({
            sourceMap: subMapJson,
            rules: options.rules,
            preset: options.preset,
            proposals: options.proposals,
          });
          for (const d of subResult.diagnostics) {
            allDiagnostics.push({
              ...d,
              message: `sections[${i}].map: ${d.message}`,
            });
          }
        }
      }
    }
  }

  // Coverage analysis
  let coverage: CoverageReport | undefined;
  if (sourceMap && options.generatedSource) {
    coverage = analyzeCoverage(sourceMap.mappings, options.generatedSource, options.generatedFileType);
  }

  const errors = allDiagnostics.filter((d) => d.severity === 'error');
  const warnings = allDiagnostics.filter((d) => d.severity === 'warning');
  const infos = allDiagnostics.filter((d) => d.severity === 'info');

  return {
    valid: errors.length === 0,
    diagnostics: allDiagnostics,
    errors,
    warnings,
    infos,
    stats: computeStats(parsed, sourceMap),
    coverage,
  };
}
