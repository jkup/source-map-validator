import { describe, it, expect } from 'vitest';
import { validate } from '../validator.js';

// Helpers to encode VLQ values for test fixtures
function encodeUnsignedVlq(value: number): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  do {
    let digit = value & 0x1f;
    value >>>= 5;
    if (value > 0) digit |= 0x20;
    result += CHARS[digit];
  } while (value > 0);
  return result;
}

function encodeSignedVlq(value: number): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = value < 0 ? (-value << 1) | 1 : value << 1;
  let result = '';
  do {
    let digit = encoded & 0x1f;
    encoded >>>= 5;
    if (encoded > 0) digit |= 0x20;
    result += CHARS[digit];
  } while (encoded > 0);
  return result;
}

const TAG_B = encodeUnsignedVlq(0x1);
const TAG_C = encodeUnsignedVlq(0x2);
const TAG_D = encodeUnsignedVlq(0x3);
const TAG_E = encodeUnsignedVlq(0x4);
const TAG_F = encodeUnsignedVlq(0x5);
const TAG_G = encodeUnsignedVlq(0x6);
const TAG_I = encodeUnsignedVlq(0x8);

const u = encodeUnsignedVlq;
const s = encodeSignedVlq;

function makeMap(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 3,
    sources: ['foo.js'],
    names: ['myFunc', 'function', 'x', 'y'],
    mappings: 'AAAA',
    ...overrides,
  });
}

function makeScopes(scopesStr: string, extra: Record<string, unknown> = {}): string {
  return makeMap({ scopes: scopesStr, ...extra });
}

function validScopes(): string {
  // A simple valid scopes string: one original scope tree + one generated range
  return [
    TAG_B + u(0) + u(0) + u(0), // B flags=0 line=0 col=0
    TAG_C + u(5) + u(0), // C line=5 col=0
    TAG_E + u(0x1) + u(0) + u(0), // E flags=HAS_LINE line=0 col=0
    TAG_F + u(0) + u(20), // F line=0 col=20
  ].join(',');
}

describe('proposal gating', () => {
  it('skips scopes rules when proposals is not set', () => {
    const result = validate({
      sourceMap: makeScopes('not-valid-vlq!!!'),
    });
    // No scopes errors because proposal is not enabled
    const scopesErrors = result.diagnostics.filter((d) => d.rule.startsWith('scopes-'));
    expect(scopesErrors).toEqual([]);
  });

  it('runs scopes rules when proposals includes scopes', () => {
    const result = validate({
      sourceMap: makeScopes('not-valid-vlq!!!'),
      proposals: ['scopes'],
    });
    // Should have scopes-related errors
    const scopesErrors = result.diagnostics.filter((d) => d.rule.startsWith('scopes-'));
    expect(scopesErrors.length).toBeGreaterThan(0);
  });

  it('does not run scopes rules when scopes field is absent', () => {
    const result = validate({
      sourceMap: makeMap(),
      proposals: ['scopes'],
    });
    const scopesErrors = result.diagnostics.filter((d) => d.rule.startsWith('scopes-'));
    expect(scopesErrors).toEqual([]);
  });
});

describe('scopes-field-type', () => {
  it('reports error when scopes is not a string', () => {
    const result = validate({
      sourceMap: makeMap({ scopes: 42 }),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-field-type');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('must be a string');
  });

  it('passes when scopes is a valid string', () => {
    const result = validate({
      sourceMap: makeScopes(validScopes()),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-field-type');
    expect(errors).toEqual([]);
  });
});

describe('scopes-positions-ordered', () => {
  it('reports error when scope end is before start', () => {
    // Scope: start at line 5, end at line 2 (end < start)
    const scopesStr = [
      TAG_B + u(0) + u(5) + u(0), // B line=5 col=0
      TAG_C + u(0) + u(0), // C relative line=0 → absolute=5, col=0 (same position = error)
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-positions-ordered');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('not after start');
  });
});

describe('scopes-sources-bounds', () => {
  it('reports error when more scope trees than sources', () => {
    // Two scope trees but only one source
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0),
      TAG_C + u(5) + u(0),
      TAG_B + u(0) + u(0) + u(0),
      TAG_C + u(5) + u(0),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr, { sources: ['foo.js'] }),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-sources-bounds');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('scope trees');
  });

  it('reports error when callsite references out-of-bounds source', () => {
    const scopesStr = [
      TAG_E + u(0x1) + u(0) + u(0),
      TAG_I + u(99) + u(0) + u(0), // sourceIndex 99 is out of bounds
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-sources-bounds');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('source index 99');
  });
});

describe('scopes-tree-balanced', () => {
  it('no nesting errors for well-nested scopes', () => {
    // Parent: 0:0-10:0, Child: 1:0-4:0 (child inside parent)
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0), // parent start 0:0
      TAG_B + u(0) + u(1) + u(0), // child start 1:0
      TAG_C + u(3) + u(0), // child end 4:0
      TAG_C + u(6) + u(0), // parent end 10:0
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const treeErrors = result.diagnostics.filter((d) => d.rule === 'scopes-tree-balanced');
    expect(treeErrors).toEqual([]);
  });
});

describe('scopes-range-bounds', () => {
  it('reports error when range exceeds generated file bounds', () => {
    // Generated range at line 100, but generated file has only 3 lines
    const scopesStr = [
      TAG_E + u(0x1) + u(100) + u(0), // E line=100 col=0
      TAG_F + u(0) + u(20), // F same line, col=20
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      generatedSource: 'line1\nline2\nline3',
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-range-bounds');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('line 100');
  });

  it('does not report when range is within bounds', () => {
    const scopesStr = [TAG_E + u(0x1) + u(0) + u(0), TAG_F + u(0) + u(5)].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      generatedSource: 'line1 with content',
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-range-bounds');
    expect(errors).toEqual([]);
  });
});

describe('scopes-callsite-valid', () => {
  it('reports error when callsite has no definition', () => {
    // Generated range with callsite but no definition (flags=0x1, no HAS_DEFINITION bit)
    const scopesStr = [
      TAG_E + u(0x1) + u(0) + u(0), // E flags=HAS_LINE, line=0 col=0 (no definition)
      TAG_I + u(0) + u(5) + u(10), // I sourceIdx=0 line=5 col=10
      TAG_F + u(0) + u(20), // F col=20
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-callsite-valid');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('no definition');
  });

  it('reports error when callsite definition is not a stack frame', () => {
    // Original scope WITHOUT isStackFrame, then generated range referencing it with callsite
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0), // B flags=0 (NOT a stack frame)
      TAG_C + u(10) + u(0), // C
      // Generated range: flags=HAS_LINE|HAS_DEFINITION, definition=0
      TAG_E + u(0x1 | 0x2) + u(0) + u(0) + s(0),
      TAG_I + u(0) + u(5) + u(10), // callsite
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-callsite-valid');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('not a stack frame');
  });

  it('reports error when range with callsite is itself a stack frame', () => {
    // Original scope WITH isStackFrame, generated range also marked as stack frame + callsite
    const scopesStr = [
      TAG_B + u(0x4) + u(0) + u(0), // B flags=IS_STACK_FRAME
      TAG_C + u(10) + u(0),
      // E flags=HAS_LINE|HAS_DEFINITION|IS_STACK_FRAME (0x1|0x2|0x4=0x7), definition=0
      TAG_E + u(0x7) + u(0) + u(0) + s(0),
      TAG_I + u(0) + u(5) + u(10),
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-callsite-valid');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('itself marked as a stack frame');
  });

  it('passes for valid callsite with stack-frame definition and no range stack frame', () => {
    const scopesStr = [
      TAG_B + u(0x4) + u(0) + u(0), // B flags=IS_STACK_FRAME
      TAG_C + u(10) + u(0),
      // E flags=HAS_LINE|HAS_DEFINITION (0x3), definition=0
      TAG_E + u(0x3) + u(0) + u(0) + s(0),
      TAG_I + u(0) + u(5) + u(10),
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-callsite-valid');
    expect(errors).toEqual([]);
  });
});

describe('scopes-mapping-scope-match', () => {
  it('warns when mapping original position is outside the definition scope', () => {
    // Original scope: lines 2-8. Mapping at original 0:0 → outside scope.
    const scopesStr = [
      TAG_B + u(0) + u(2) + u(0), // B: scope start at 2:0
      TAG_C + u(6) + u(0), // C: scope end at 8:0
      // Generated range covering gen line 0, definition=0
      TAG_E + u(0x3) + u(0) + u(0) + s(0), // E flags=HAS_LINE|HAS_DEFINITION line=0 col=0 def=0
      TAG_F + u(0) + u(20), // F col=20
    ].join(',');

    const result = validate({
      // mappings 'AAAA' = gen 0:0 → original 0:0 (outside scope 2:0-8:0)
      sourceMap: makeScopes(scopesStr, { mappings: 'AAAA' }),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-mapping-scope-match');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('outside');
  });

  it('passes when mapping original position is inside the definition scope', () => {
    // Original scope: lines 0-10. Mapping at original 3:0 → inside scope.
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0), // B: scope start at 0:0
      TAG_C + u(10) + u(0), // C: scope end at 10:0
      TAG_E + u(0x3) + u(0) + u(0) + s(0), // E definition=0
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      // 'AAGA' = gen 0:0 → original 3:0 (inside scope 0:0-10:0)
      sourceMap: makeScopes(scopesStr, { mappings: 'AAGA' }),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-mapping-scope-match');
    expect(warnings).toEqual([]);
  });

  it('skips ranges without a definition', () => {
    const scopesStr = [
      TAG_B + u(0) + u(2) + u(0),
      TAG_C + u(6) + u(0),
      // E flags=HAS_LINE only (no HAS_DEFINITION)
      TAG_E + u(0x1) + u(0) + u(0),
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr, { mappings: 'AAAA' }),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-mapping-scope-match');
    expect(warnings).toEqual([]);
  });
});

describe('scopes-bindings-count', () => {
  it('warns when bindings count does not match variables count', () => {
    // Scope with 2 variables, but range provides 1 binding
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0), // B flags=0
      TAG_D + s(0) + s(1), // D variables: names[0], names[1] (2 variables)
      TAG_C + u(10) + u(0),
      // E flags=HAS_LINE|HAS_DEFINITION, definition=0
      TAG_E + u(0x3) + u(0) + u(0) + s(0),
      TAG_G + u(1), // G binding=1 (only 1 binding, should be 2)
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr, { names: ['x', 'y', 'expr1'] }),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-bindings-count');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('1 bindings');
    expect(warnings[0]!.message).toContain('2 variables');
  });

  it('passes when bindings count matches variables count', () => {
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0),
      TAG_D + s(0) + s(1), // 2 variables
      TAG_C + u(10) + u(0),
      TAG_E + u(0x3) + u(0) + u(0) + s(0),
      TAG_G + u(1) + u(2), // 2 bindings
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr, { names: ['x', 'y', 'expr1', 'expr2'] }),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-bindings-count');
    expect(warnings).toEqual([]);
  });

  it('passes when range has no bindings at all', () => {
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0),
      TAG_D + s(0), // 1 variable
      TAG_C + u(10) + u(0),
      TAG_E + u(0x3) + u(0) + u(0) + s(0),
      TAG_F + u(0) + u(20), // no G tag = no bindings
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr, { names: ['x'] }),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-bindings-count');
    expect(warnings).toEqual([]);
  });
});

describe('scopes-definition-bounds', () => {
  it('reports error when definition index exceeds scope count', () => {
    // One original scope (index 0), but definition references index 5
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0),
      TAG_C + u(5) + u(0),
      // E flags=HAS_LINE|HAS_DEFINITION, definition=5 (out of bounds)
      TAG_E + u(0x3) + u(0) + u(0) + s(5),
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-definition-bounds');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('definition index 5');
  });

  it('passes when definition index is valid', () => {
    const scopesStr = [
      TAG_B + u(0) + u(0) + u(0),
      TAG_C + u(5) + u(0),
      TAG_E + u(0x3) + u(0) + u(0) + s(0),
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const errors = result.diagnostics.filter((d) => d.rule === 'scopes-definition-bounds');
    expect(errors).toEqual([]);
  });
});

describe('scopes-range-flags-valid', () => {
  it('warns when IS_HIDDEN is set without IS_STACK_FRAME', () => {
    // flags=0x1|0x8=0x9: HAS_LINE + IS_HIDDEN but no IS_STACK_FRAME
    const scopesStr = [
      TAG_E + u(0x9) + u(0) + u(0),
      TAG_F + u(0) + u(10),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-range-flags-valid');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain('IS_HIDDEN');
    expect(warnings[0]!.severity).toBe('warning');
  });

  it('no warning when IS_HIDDEN and IS_STACK_FRAME are both set', () => {
    const scopesStr = [
      TAG_E + u(0x1 | 0x4 | 0x8) + u(0) + u(0),
      TAG_F + u(0) + u(10),
    ].join(',');

    const result = validate({
      sourceMap: makeScopes(scopesStr),
      proposals: ['scopes'],
    });
    const warnings = result.diagnostics.filter((d) => d.rule === 'scopes-range-flags-valid');
    expect(warnings).toEqual([]);
  });
});

describe('scopes not flagged as extension field', () => {
  it('does not report scopes as an unrecognized field', () => {
    const result = validate({
      sourceMap: makeScopes(validScopes()),
    });
    const extensionErrors = result.diagnostics.filter(
      (d) => d.rule === 'extension-fields' && d.message.includes('scopes'),
    );
    expect(extensionErrors).toEqual([]);
  });
});

describe('valid scopes pass all rules', () => {
  it('produces no scopes diagnostics for a valid scopes string', () => {
    const result = validate({
      sourceMap: makeScopes(validScopes()),
      proposals: ['scopes'],
    });
    const scopesDiags = result.diagnostics.filter((d) => d.rule.startsWith('scopes-'));
    expect(scopesDiags).toEqual([]);
  });
});

describe('stats.hasScopes', () => {
  it('is true when scopes field is present', () => {
    const result = validate({ sourceMap: makeScopes(validScopes()) });
    expect(result.stats.hasScopes).toBe(true);
  });

  it('is false when scopes field is absent', () => {
    const result = validate({ sourceMap: makeMap() });
    expect(result.stats.hasScopes).toBe(false);
  });
});
