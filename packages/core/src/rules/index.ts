import type { Rule } from '../types.js';

// Proposal: scopes
import { scopesFieldTypeRule } from './proposal/scopes-field-type.js';
import { scopesDecodeValidRule } from './proposal/scopes-decode-valid.js';
import { scopesTreeBalancedRule } from './proposal/scopes-tree-balanced.js';
import { scopesNamesBoundsRule } from './proposal/scopes-names-bounds.js';
import { scopesSourcesBoundsRule } from './proposal/scopes-sources-bounds.js';
import { scopesPositionsOrderedRule } from './proposal/scopes-positions-ordered.js';
import { scopesRangeBoundsRule } from './proposal/scopes-range-bounds.js';
import { scopesOriginalBoundsRule } from './proposal/scopes-original-bounds.js';
import { scopesCallsiteValidRule } from './proposal/scopes-callsite-valid.js';
import { scopesRangeFlagsValidRule } from './proposal/scopes-range-flags-valid.js';
import { scopesDefinitionBoundsRule } from './proposal/scopes-definition-bounds.js';
import { scopesBindingsCountRule } from './proposal/scopes-bindings-count.js';
import { scopesMappingScopeMatchRule } from './proposal/scopes-mapping-scope-match.js';

// Level 1: Format validation
import { validJsonRule } from './format/valid-json.js';
import { versionFieldRule } from './format/version-field.js';
import { requiredFieldsRule } from './format/required-fields.js';
import { fieldTypesRule } from './format/field-types.js';
import { sourcesContentLengthRule } from './format/sources-content-length.js';
import { ignoreListBoundsRule } from './format/ignore-list-bounds.js';
import { vlqValidRule } from './format/vlq-valid.js';
import { segmentFieldCountRule } from './format/segment-field-count.js';
import { mappingIndexBoundsRule } from './format/mapping-index-bounds.js';
import { columnOrderingRule } from './format/column-ordering.js';
import { nonNegativePositionsRule } from './format/non-negative-positions.js';
import { indexMapValidRule } from './format/index-map-valid.js';

// Level 2: Generated file validation
import { mappingsInGeneratedBoundsRule } from './generated/mappings-in-generated-bounds.js';
import { sourceMappingUrlRule } from './generated/source-mapping-url.js';

// Level 3: Deep validation
import { mappingsInOriginalBoundsRule } from './deep/mappings-in-original-bounds.js';
import { tokenMatchingRule } from './deep/token-matching.js';
import { sourcesContentConsistencyRule } from './deep/sources-content-consistency.js';

// Level 4: Advisory
import { noAbsolutePathsRule } from './advisory/no-absolute-paths.js';
import { noBackslashPathsRule } from './advisory/no-backslash-paths.js';
import { hasSourcesContentRule } from './advisory/has-sources-content.js';
import { hasIgnoreListRule } from './advisory/has-ignore-list.js';
import { deprecatedXGoogleRule } from './advisory/deprecated-x-google.js';
import { extensionFieldsRule } from './advisory/extension-fields.js';
import { sourcesResolvableRule } from './advisory/sources-resolvable.js';

/**
 * All available rules in execution order.
 * Level 1 rules run first, then 2, 3, 4.
 */
export const allRules: Rule[] = [
  // Level 1
  validJsonRule,
  versionFieldRule,
  requiredFieldsRule,
  fieldTypesRule,
  sourcesContentLengthRule,
  ignoreListBoundsRule,
  vlqValidRule,
  segmentFieldCountRule,
  mappingIndexBoundsRule,
  columnOrderingRule,
  nonNegativePositionsRule,
  indexMapValidRule,

  // Level 2
  mappingsInGeneratedBoundsRule,
  sourceMappingUrlRule,

  // Level 3
  mappingsInOriginalBoundsRule,
  tokenMatchingRule,
  sourcesContentConsistencyRule,

  // Level 4
  noAbsolutePathsRule,
  noBackslashPathsRule,
  hasSourcesContentRule,
  hasIgnoreListRule,
  deprecatedXGoogleRule,
  extensionFieldsRule,
  sourcesResolvableRule,

  // Proposal: scopes
  scopesFieldTypeRule,
  scopesDecodeValidRule,
  scopesTreeBalancedRule,
  scopesNamesBoundsRule,
  scopesSourcesBoundsRule,
  scopesPositionsOrderedRule,
  scopesRangeBoundsRule,
  scopesOriginalBoundsRule,
  scopesCallsiteValidRule,
  scopesRangeFlagsValidRule,
  scopesDefinitionBoundsRule,
  scopesBindingsCountRule,
  scopesMappingScopeMatchRule,
];

/** Rule index by id */
export const ruleById: Map<string, Rule> = new Map(allRules.map((r) => [r.id, r]));

/** Set of all proposal names referenced by rules */
export const allProposals: Set<string> = new Set(
  allRules.filter((r) => r.proposal).map((r) => r.proposal!),
);
