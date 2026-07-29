import { describe, it, expect } from 'vitest';
import { decodeScopes } from '../scopes-decoder.js';

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

// Tag constants
const TAG_B = encodeUnsignedVlq(0x1); // original_scope_start
const TAG_C = encodeUnsignedVlq(0x2); // original_scope_end
const TAG_D = encodeUnsignedVlq(0x3); // original_scope_variables
const TAG_E = encodeUnsignedVlq(0x4); // generated_range_start
const TAG_F = encodeUnsignedVlq(0x5); // generated_range_end
const TAG_G = encodeUnsignedVlq(0x6); // generated_range_bindings
const TAG_H = encodeUnsignedVlq(0x7); // generated_range_subrange_binding
const TAG_I = encodeUnsignedVlq(0x8); // generated_range_callsite

const u = encodeUnsignedVlq;
const s = encodeSignedVlq;

describe('decodeScopes', () => {
  it('returns empty result for empty string', () => {
    const result = decodeScopes('', []);
    expect(result.scopes.originalScopes).toEqual([]);
    expect(result.scopes.generatedRanges).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('decodes a simple original scope (no name, no kind)', () => {
    // tag B, flags=0, line=0, col=0, tag C, line=5, col=10
    const input = [
      TAG_B + u(0) + u(0) + u(0), // B flags=0 line=0 col=0
      TAG_C + u(5) + u(10), // C line=5 col=10
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.originalScopes).toHaveLength(1);
    const scope = result.scopes.originalScopes[0]!;
    expect(scope.start).toEqual({ line: 0, column: 0 });
    expect(scope.end).toEqual({ line: 5, column: 10 });
    expect(scope.isStackFrame).toBe(false);
    expect(scope.name).toBeUndefined();
    expect(scope.kind).toBeUndefined();
    expect(scope.variables).toEqual([]);
    expect(scope.children).toEqual([]);
  });

  it('decodes an original scope with kind only (flags=0x2, no name)', () => {
    const names = ['function'];
    // flags = HAS_KIND only = 0x2 — ScopeNameOrKind contains the kind
    const input = [
      TAG_B + u(0x2) + u(0) + u(0) + s(0), // B flags=2 line=0 col=0 kind=0(function)
      TAG_C + u(5) + u(0),
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const scope = result.scopes.originalScopes[0]!;
    expect(scope.name).toBeUndefined();
    expect(scope.kind).toBe('function');
  });

  it('decodes an original scope with name and kind', () => {
    const names = ['myFunc', 'function'];
    // flags = HAS_NAME | HAS_KIND = 0x1 | 0x2 = 0x3
    const input = [
      TAG_B + u(0x3) + u(1) + u(0) + s(0) + s(1), // B flags=3 line=1 col=0 name=0(myFunc) kind=1(function)
      TAG_C + u(10) + u(0), // C line=11 col=0
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const scope = result.scopes.originalScopes[0]!;
    expect(scope.name).toBe('myFunc');
    expect(scope.kind).toBe('function');
    expect(scope.start).toEqual({ line: 1, column: 0 });
    expect(scope.end).toEqual({ line: 11, column: 0 });
  });

  it('decodes an original scope with variables', () => {
    const names = ['x', 'y', 'z'];
    const input = [
      TAG_B + u(0) + u(0) + u(0), // B flags=0 line=0 col=0
      TAG_D + s(0) + s(1) + s(1), // D variables: 0(x), 1(y), 2(z)
      TAG_C + u(10) + u(0), // C line=10 col=0
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const scope = result.scopes.originalScopes[0]!;
    expect(scope.variables).toEqual(['x', 'y', 'z']);
  });

  it('decodes nested original scopes', () => {
    const input = [
      TAG_B + u(0) + u(0) + u(0), // outer: B line=0 col=0
      TAG_B + u(0) + u(1) + u(0), // inner: B line=1 col=0
      TAG_C + u(3) + u(0), // inner: C line=4 col=0
      TAG_C + u(6) + u(0), // outer: C line=10 col=0
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    const outer = result.scopes.originalScopes[0]!;
    expect(outer.start).toEqual({ line: 0, column: 0 });
    expect(outer.end).toEqual({ line: 10, column: 0 });
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0]!;
    expect(inner.start).toEqual({ line: 1, column: 0 });
    expect(inner.end).toEqual({ line: 4, column: 0 });
  });

  it('accumulates column when line increment is 0 (same-line scopes)', () => {
    // Parent: start at 0:5, child: relLine=0 relCol=3 → should be 0:8 (not 0:3)
    const input = [
      TAG_B + u(0) + u(0) + u(5), // parent: line=0 col=5
      TAG_B + u(0) + u(0) + u(3), // child: relLine=0 relCol=3 → 0:8
      TAG_C + u(0) + u(2), // child end: relLine=0 relCol=2 → 0:10
      TAG_C + u(1) + u(0), // parent end: relLine=1 → line=1 col=0
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    const parent = result.scopes.originalScopes[0]!;
    expect(parent.start).toEqual({ line: 0, column: 5 });
    const child = parent.children[0]!;
    expect(child.start).toEqual({ line: 0, column: 8 });
    expect(child.end).toEqual({ line: 0, column: 10 });
    expect(parent.end).toEqual({ line: 1, column: 0 });
  });

  it('resets column when line increment is non-zero', () => {
    // Start at 2:10, child at relLine=1 relCol=3 → should be 3:3 (column is absolute)
    const input = [
      TAG_B + u(0) + u(2) + u(10), // parent: line=2 col=10
      TAG_B + u(0) + u(1) + u(3), // child: relLine=1 → line=3, col=3 (absolute)
      TAG_C + u(2) + u(0), // child end: line=5 col=0
      TAG_C + u(5) + u(0), // parent end: line=10 col=0
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    const child = result.scopes.originalScopes[0]!.children[0]!;
    expect(child.start).toEqual({ line: 3, column: 3 });
    expect(child.end).toEqual({ line: 5, column: 0 });
  });

  it('resets position accumulator between scope trees', () => {
    // First tree: scope at line 10. Second tree: should start from 0 again.
    const input = [
      TAG_B + u(0) + u(10) + u(5), // tree 1: start at 10:5
      TAG_C + u(10) + u(0), // tree 1: end at 20:0
      TAG_B + u(0) + u(2) + u(3), // tree 2: should be 2:3 (not 22:3)
      TAG_C + u(5) + u(0), // tree 2: end at 7:0
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.originalScopes).toHaveLength(2);
    expect(result.scopes.originalScopes[0]!.start).toEqual({ line: 10, column: 5 });
    expect(result.scopes.originalScopes[1]!.start).toEqual({ line: 2, column: 3 });
    expect(result.scopes.originalScopes[1]!.end).toEqual({ line: 7, column: 0 });
  });

  it('handles null scope trees (empty slots via commas)', () => {
    // First source has no scopes, second has a scope
    const input = [
      '', // empty = null for source 0
      TAG_B + u(0) + u(0) + u(0), // B for source 1
      TAG_C + u(5) + u(0), // C
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.originalScopes).toHaveLength(2);
    expect(result.scopes.originalScopes[0]).toBeNull();
    expect(result.scopes.originalScopes[1]).not.toBeNull();
  });

  it('handles EmptyItem (A tag) as null scope tree', () => {
    // 'A' is VLQ unsigned value 0, the spec EmptyItem
    const TAG_A = u(0); // 'A'
    const input = [
      TAG_A, // null for source 0
      TAG_B + u(0) + u(0) + u(0), // B for source 1
      TAG_C + u(5) + u(0), // C
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.originalScopes).toHaveLength(2);
    expect(result.scopes.originalScopes[0]).toBeNull();
    expect(result.scopes.originalScopes[1]).not.toBeNull();
  });

  it('handles mixed A tags and scope trees for multiple sources', () => {
    const TAG_A = u(0);
    // Three sources: scope, null, scope
    const input = [
      TAG_B + u(0) + u(0) + u(0), // source 0: scope
      TAG_C + u(5) + u(0),
      TAG_A, // source 1: null
      TAG_B + u(0) + u(0) + u(0), // source 2: scope
      TAG_C + u(3) + u(0),
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.originalScopes).toHaveLength(3);
    expect(result.scopes.originalScopes[0]).not.toBeNull();
    expect(result.scopes.originalScopes[1]).toBeNull();
    expect(result.scopes.originalScopes[2]).not.toBeNull();
  });

  it('decodes a simple generated range', () => {
    // tag E, flags=HAS_LINE(0x1), line=0, col=0
    // tag F, line=0, col=20
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // E flags=1 line=0 col=0
      TAG_F + u(0) + u(20), // F line=0 col=20
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.generatedRanges).toHaveLength(1);
    const range = result.scopes.generatedRanges[0]!;
    expect(range.start).toEqual({ line: 0, column: 0 });
    expect(range.end).toEqual({ line: 0, column: 20 });
    expect(range.isStackFrame).toBe(false);
    expect(range.isHidden).toBe(false);
  });

  it('decodes a generated range with definition', () => {
    const names = ['myFunc', 'function'];
    // Build: original scope first, then generated range referencing it
    const input = [
      // Original scope tree
      TAG_B + u(0) + u(0) + u(0), // B for source 0
      TAG_C + u(5) + u(0), // C
      // Generated range with definition
      TAG_E + u(0x1 | 0x2) + u(0) + u(0) + s(0), // E flags=3 line=0 col=0 definition=0
      TAG_F + u(0) + u(50), // F line=0 col=50
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.generatedRanges).toHaveLength(1);
    expect(result.scopes.generatedRanges[0]!.definition).toBe(0);
  });

  it('decodes a generated range with callsite', () => {
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // E flags=1 line=0 col=0
      TAG_I + u(0) + u(5) + u(10), // I sourceIdx=0 line=5 col=10
      TAG_F + u(10) + u(0), // F line=10 col=0
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    const range = result.scopes.generatedRanges[0]!;
    expect(range.callsite).toEqual({ sourceIndex: 0, line: 5, column: 10 });
  });

  it('decodes a generated range with bindings', () => {
    const names = ['x_expr', 'y_expr'];
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // E
      TAG_G + u(1) + u(2), // G binding=1(x_expr, 1-based) binding=2(y_expr)
      TAG_F + u(0) + u(50), // F
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const range = result.scopes.generatedRanges[0]!;
    expect(range.bindings).toHaveLength(2);
    expect(range.bindings[0]).toEqual({ type: 'simple', expression: 'x_expr' });
    expect(range.bindings[1]).toEqual({ type: 'simple', expression: 'y_expr' });
  });

  it('handles binding value 0 as unavailable', () => {
    const names = ['expr'];
    const input = [
      TAG_E + u(0x1) + u(0) + u(0),
      TAG_G + u(0), // 0 = unavailable
      TAG_F + u(0) + u(50),
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const range = result.scopes.generatedRanges[0]!;
    expect(range.bindings[0]).toEqual({ type: 'simple', expression: undefined });
  });

  it('decodes stack frame flag', () => {
    const input = [
      TAG_B + u(0x4) + u(0) + u(0), // B flags=IS_STACK_FRAME
      TAG_C + u(5) + u(0),
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.scopes.originalScopes[0]!.isStackFrame).toBe(true);
  });

  it('decodes stack frame generated range (IS_STACK_FRAME without IS_HIDDEN)', () => {
    const input = [
      TAG_E + u(0x1 | 0x4) + u(0) + u(0), // E flags=HAS_LINE | IS_STACK_FRAME
      TAG_F + u(0) + u(10),
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.scopes.generatedRanges[0]!.isStackFrame).toBe(true);
    expect(result.scopes.generatedRanges[0]!.isHidden).toBe(false);
  });

  it('decodes IS_STACK_FRAME + IS_HIDDEN generated range', () => {
    const input = [
      TAG_E + u(0x1 | 0x4 | 0x8) + u(0) + u(0), // E flags=HAS_LINE | IS_STACK_FRAME | IS_HIDDEN
      TAG_F + u(0) + u(10),
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.scopes.generatedRanges[0]!.isStackFrame).toBe(true);
    expect(result.scopes.generatedRanges[0]!.isHidden).toBe(true);
  });

  it('decodes hidden generated range', () => {
    const input = [
      TAG_E + u(0x1 | 0x8) + u(0) + u(0), // E flags=HAS_LINE | IS_HIDDEN
      TAG_F + u(0) + u(10),
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.scopes.generatedRanges[0]!.isHidden).toBe(true);
  });

  it('carries position across multiple top-level generated ranges', () => {
    // First range: 0:0 to 0:20. Second range: relLine=1 → starts at 1:col
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // range 1: line=0 col=0
      TAG_F + u(0) + u(20), // range 1 end: col=20 (relative → 0:20)
      TAG_E + u(0x1) + u(1) + u(5), // range 2: relLine=1 → line=1, col=5
      TAG_F + u(1) + u(0), // range 2 end: relLine=1 → line=2, col=0
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.generatedRanges).toHaveLength(2);
    expect(result.scopes.generatedRanges[0]!.start).toEqual({ line: 0, column: 0 });
    expect(result.scopes.generatedRanges[0]!.end).toEqual({ line: 0, column: 20 });
    expect(result.scopes.generatedRanges[1]!.start).toEqual({ line: 1, column: 5 });
    expect(result.scopes.generatedRanges[1]!.end).toEqual({ line: 2, column: 0 });
  });

  it('decodes nested generated ranges', () => {
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // outer: line=0 col=0
      TAG_E + u(0x1) + u(0) + u(5), // inner: relLine=0 relCol=5 → 0:5
      TAG_F + u(0) + u(5), // inner end: relCol=5 → 0:10
      TAG_F + u(1) + u(0), // outer end: relLine=1 → 1:0
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.generatedRanges).toHaveLength(1);
    const outer = result.scopes.generatedRanges[0]!;
    expect(outer.start).toEqual({ line: 0, column: 0 });
    expect(outer.end).toEqual({ line: 1, column: 0 });
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0]!;
    expect(inner.start).toEqual({ line: 0, column: 5 });
    expect(inner.end).toEqual({ line: 0, column: 10 });
  });

  it('decodes generated range without HAS_LINE (column-only mode)', () => {
    // First range at 2:10. Second range without HAS_LINE: column is relative.
    const input = [
      TAG_E + u(0x1) + u(2) + u(10), // range 1: line=2 col=10
      TAG_F + u(0) + u(20), // range 1 end: col=30 (relative to 10)
      TAG_E + u(0) + u(5), // range 2: no HAS_LINE, relCol=5 → 2:35
      TAG_F + u(5), // range 2 end: relCol=5 → 2:40
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.generatedRanges).toHaveLength(2);
    expect(result.scopes.generatedRanges[1]!.start).toEqual({ line: 2, column: 35 });
    expect(result.scopes.generatedRanges[1]!.end).toEqual({ line: 2, column: 40 });
  });

  it('decodes a sub-range binding (tag H)', () => {
    const names = ['a_expr', 'b_expr'];
    // Range starts at 0:0, H tag: varIndex=0, then one BindingFrom: line=0 col=5 expr=1(a_expr)
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // E flags=HAS_LINE line=0 col=0
      TAG_H + u(0) + u(0) + u(5) + u(1), // H varIdx=0, relLine=0 relCol=5 expr=1(a_expr)
      TAG_F + u(0) + u(50), // F line=0 col=50
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const range = result.scopes.generatedRanges[0]!;
    expect(range.bindings).toHaveLength(1);
    expect(range.bindings[0]).toEqual({
      type: 'subrange',
      variableIndex: 0,
      ranges: [{ from: { line: 0, column: 5 }, expression: 'a_expr' }],
    });
  });

  it('decodes multiple BindingFrom entries in a sub-range binding', () => {
    const names = ['a_expr', 'b_expr'];
    // Range starts at 1:10, two BindingFrom entries
    const input = [
      TAG_E + u(0x1) + u(1) + u(10), // E line=1 col=10
      // H varIdx=0:
      //   BindingFrom 1: relLine=0 relCol=0 expr=1(a_expr) -> absolute 1:10
      //   BindingFrom 2: relLine=0 relCol=5 expr=2(b_expr) -> accumulated 1:15
      TAG_H + u(0) + u(0) + u(0) + u(1) + u(0) + u(5) + u(2),
      TAG_F + u(0) + u(50), // F col=50
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const range = result.scopes.generatedRanges[0]!;
    expect(range.bindings[0]).toEqual({
      type: 'subrange',
      variableIndex: 0,
      ranges: [
        { from: { line: 1, column: 10 }, expression: 'a_expr' },
        { from: { line: 1, column: 15 }, expression: 'b_expr' },
      ],
    });
  });

  it('accumulates sub-range binding positions across lines', () => {
    const names = ['expr1', 'expr2'];
    // Range starts at 2:5
    // BindingFrom 1: relLine=0 relCol=0 expr=1 -> 2:5
    // BindingFrom 2: relLine=1 relCol=3 expr=2 -> 3:3 (line changes, col is absolute)
    const input = [
      TAG_E + u(0x1) + u(2) + u(5), // E line=2 col=5
      TAG_H + u(0) + u(0) + u(0) + u(1) + u(1) + u(3) + u(2),
      TAG_F + u(1) + u(0), // F line=3 col=0 -> absolute 4:0 (accumulated)
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const binding = result.scopes.generatedRanges[0]!.bindings[0]!;
    expect(binding).toEqual({
      type: 'subrange',
      variableIndex: 0,
      ranges: [
        { from: { line: 2, column: 5 }, expression: 'expr1' },
        { from: { line: 3, column: 3 }, expression: 'expr2' },
      ],
    });
  });

  it('handles unavailable expression (0) in sub-range binding', () => {
    const names = ['expr'];
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // E line=0 col=0
      TAG_H + u(0) + u(0) + u(5) + u(0), // H varIdx=0, relLine=0 relCol=5 expr=0(unavailable)
      TAG_F + u(0) + u(50),
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const binding = result.scopes.generatedRanges[0]!.bindings[0]!;
    expect(binding).toEqual({
      type: 'subrange',
      variableIndex: 0,
      ranges: [{ from: { line: 0, column: 5 }, expression: undefined }],
    });
  });

  it('decodes multiple sub-range bindings for different variables', () => {
    const names = ['a', 'b'];
    const input = [
      TAG_E + u(0x1) + u(0) + u(0), // E line=0 col=0
      TAG_H + u(0) + u(0) + u(5) + u(1), // H varIdx=0, from 0:5 expr=a
      TAG_H + u(1) + u(0) + u(10) + u(2), // H varIdx=1, from 0:10 expr=b
      TAG_F + u(0) + u(50),
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const range = result.scopes.generatedRanges[0]!;
    expect(range.bindings).toHaveLength(2);
    expect(range.bindings[0]).toEqual({
      type: 'subrange',
      variableIndex: 0,
      ranges: [{ from: { line: 0, column: 5 }, expression: 'a' }],
    });
    expect(range.bindings[1]).toEqual({
      type: 'subrange',
      variableIndex: 1,
      ranges: [{ from: { line: 0, column: 10 }, expression: 'b' }],
    });
  });

  it('tolerates unknown high flag bits on original scope', () => {
    // flags=0x1C = IS_STACK_FRAME (0x4) + unknown bits (0x8, 0x10)
    const names = ['fn'];
    const input = [
      TAG_B + u(0x1c) + u(0) + u(0), // B flags=0x1C (includes 0x4=stack frame)
      TAG_C + u(5) + u(0),
    ].join(',');

    const result = decodeScopes(input, names);
    expect(result.diagnostics).toEqual([]);
    const scope = result.scopes.originalScopes[0]!;
    expect(scope.isStackFrame).toBe(true);
  });

  it('tolerates unknown high flag bits on generated range', () => {
    // flags=0x11 = HAS_LINE (0x1) + unknown bit (0x10)
    const input = [
      TAG_E + u(0x11) + u(0) + u(0), // E flags=0x11
      TAG_F + u(0) + u(10),
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.diagnostics).toEqual([]);
    expect(result.scopes.generatedRanges[0]!.start).toEqual({ line: 0, column: 0 });
  });

  it('skips unknown tags gracefully inside scope tree', () => {
    // Tag value 10 (0xA) is not a known tag — decoder should skip it
    const TAG_UNKNOWN = u(10);
    const input = [
      TAG_B + u(0) + u(0) + u(0), // B: scope start
      TAG_UNKNOWN + u(42) + u(99), // unknown tag with some VLQ data
      TAG_C + u(5) + u(0), // C: scope end
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.scopes.originalScopes).toHaveLength(1);
    expect(result.scopes.originalScopes[0]!.start).toEqual({ line: 0, column: 0 });
    expect(result.scopes.originalScopes[0]!.end).toEqual({ line: 5, column: 0 });
  });

  it('skips unknown tags at top level', () => {
    const TAG_UNKNOWN = u(15);
    const input = [
      TAG_UNKNOWN + u(1) + u(2), // unknown top-level tag, should be skipped
      TAG_E + u(0x1) + u(0) + u(0),
      TAG_F + u(0) + u(20),
    ].join(',');

    const result = decodeScopes(input, []);
    expect(result.scopes.generatedRanges).toHaveLength(1);
  });

  it('reports error for invalid VLQ', () => {
    const result = decodeScopes('!!!', []);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.rule).toBe('scopes-decode-valid');
    expect(result.diagnostics[0]!.severity).toBe('error');
  });

  it('reports error for unterminated scope', () => {
    // tag B start but no tag C end
    const input = TAG_B + u(0) + u(0) + u(0);
    const result = decodeScopes(input, []);
    expect(result.diagnostics.some((d) => d.message.includes('Unterminated'))).toBe(true);
  });
});
