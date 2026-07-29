import type {
  Diagnostic,
  DecodedScopes,
  DecodedOriginalScope,
  DecodedGeneratedRange,
  DecodedBinding,
  DecodedBindingRange,
} from './types.js';
import { decodeVlqSigned, decodeVlqUnsigned, skipToNextItem } from './vlq.js';

// Tag values (encoded as unsigned VLQ)
const TAG_ORIGINAL_SCOPE_START = 0x1; // B
const TAG_ORIGINAL_SCOPE_END = 0x2; // C
const TAG_ORIGINAL_SCOPE_VARIABLES = 0x3; // D
const TAG_GENERATED_RANGE_START = 0x4; // E
const TAG_GENERATED_RANGE_END = 0x5; // F
const TAG_GENERATED_RANGE_BINDINGS = 0x6; // G
const TAG_GENERATED_RANGE_SUBRANGE_BINDING = 0x7; // H
const TAG_GENERATED_RANGE_CALLSITE = 0x8; // I

// Flag bits for original scope start (tag B)
const SCOPE_HAS_NAME = 0x1;
const SCOPE_HAS_KIND = 0x2;
const SCOPE_IS_STACK_FRAME = 0x4;

// Flag bits for generated range start (tag E)
const RANGE_HAS_LINE = 0x1;
const RANGE_HAS_DEFINITION = 0x2;
const RANGE_IS_STACK_FRAME = 0x4;
const RANGE_IS_HIDDEN = 0x8;

export interface ScopesDecodeResult {
  scopes: DecodedScopes;
  diagnostics: Diagnostic[];
}

interface DecoderState {
  index: number;
  input: string;
  names: string[];
  diagnostics: Diagnostic[];
  // Relative state that persists across trees
  relName: number;
  relKind: number;
  relVariable: number;
  relDefinition: number;
  // Position accumulator for original scopes (reset per top-level tree)
  scopeLine: number;
  scopeColumn: number;
  // Relative state for generated ranges
  relGenLine: number;
  relGenColumn: number;
}

function emitError(state: DecoderState, message: string): void {
  state.diagnostics.push({
    rule: 'scopes-decode-valid',
    severity: 'error',
    message,
  });
}

function readUnsigned(state: DecoderState): number | null {
  const result = decodeVlqUnsigned(state.input, state.index);
  if ('error' in result) {
    emitError(state, result.error);
    state.index = skipToNextItem(state.input, state.index);
    return null;
  }
  state.index = result.nextIndex;
  return result.value;
}

function readSigned(state: DecoderState): number | null {
  const result = decodeVlqSigned(state.input, state.index);
  if ('error' in result) {
    emitError(state, result.error);
    state.index = skipToNextItem(state.input, state.index);
    return null;
  }
  state.index = result.nextIndex;
  return result.value;
}

function atItemBoundary(state: DecoderState): boolean {
  return state.index >= state.input.length || state.input[state.index] === ',';
}

function consumeComma(state: DecoderState): void {
  if (state.index < state.input.length && state.input[state.index] === ',') {
    state.index++;
  }
}

function peekTag(state: DecoderState): number | null {
  if (atItemBoundary(state)) return null;
  const saved = state.index;
  const result = decodeVlqUnsigned(state.input, state.index);
  state.index = saved;
  if ('error' in result) return null;
  return result.value;
}

function resolveName(state: DecoderState, index: number): string | undefined {
  if (index >= 0 && index < state.names.length) {
    return state.names[index];
  }
  return undefined;
}

function accumulatePosition(
  state: DecoderState,
  kind: 'scope' | 'range',
  relLine: number,
  relCol: number,
): { line: number; column: number } {
  if (kind === 'scope') {
    state.scopeLine += relLine;
    if (relLine === 0) {
      state.scopeColumn += relCol;
    } else {
      state.scopeColumn = relCol;
    }
    return { line: state.scopeLine, column: state.scopeColumn };
  }
  state.relGenLine += relLine;
  if (relLine === 0) {
    state.relGenColumn += relCol;
  } else {
    state.relGenColumn = relCol;
  }
  return { line: state.relGenLine, column: state.relGenColumn };
}

function decodeOriginalScopeTree(state: DecoderState): DecodedOriginalScope | null {
  // Read tag B
  const tag = readUnsigned(state);
  if (tag === null) return null;
  if (tag !== TAG_ORIGINAL_SCOPE_START) {
    emitError(state, `Expected original scope start tag (B), got tag ${tag}`);
    state.index = skipToNextItem(state.input, state.index);
    return null;
  }

  const flags = readUnsigned(state);
  if (flags === null) return null;

  const relLine = readUnsigned(state);
  if (relLine === null) return null;
  const relCol = readUnsigned(state);
  if (relCol === null) return null;
  const start = accumulatePosition(state, 'scope', relLine, relCol);

  let name: string | undefined;
  if (flags & SCOPE_HAS_NAME) {
    const nameRel = readSigned(state);
    if (nameRel === null) return null;
    state.relName += nameRel;
    name = resolveName(state, state.relName);
  }

  let kind: string | undefined;
  if (flags & SCOPE_HAS_KIND) {
    const kindRel = readSigned(state);
    if (kindRel === null) return null;
    state.relKind += kindRel;
    kind = resolveName(state, state.relKind);
  }

  const isStackFrame = (flags & SCOPE_IS_STACK_FRAME) !== 0;

  const scope: DecodedOriginalScope = {
    start,
    end: { line: 0, column: 0 },
    isStackFrame,
    variables: [],
    children: [],
  };
  if (name !== undefined) scope.name = name;
  if (kind !== undefined) scope.kind = kind;

  // Read children and variables until we hit tag C (end)
  while (state.index < state.input.length) {
    consumeComma(state);
    if (state.index >= state.input.length) break;

    const nextTag = peekTag(state);
    if (nextTag === null) break;

    if (nextTag === TAG_ORIGINAL_SCOPE_END) {
      readUnsigned(state); // consume tag C
      const endRelLine = readUnsigned(state);
      if (endRelLine === null) return null;
      const endRelCol = readUnsigned(state);
      if (endRelCol === null) return null;
      scope.end = accumulatePosition(state, 'scope', endRelLine, endRelCol);
      return scope;
    }

    if (nextTag === TAG_ORIGINAL_SCOPE_VARIABLES) {
      readUnsigned(state); // consume tag D
      while (!atItemBoundary(state)) {
        const varRel = readSigned(state);
        if (varRel === null) break;
        state.relVariable += varRel;
        const varName = resolveName(state, state.relVariable);
        scope.variables.push(varName ?? `<name ${state.relVariable}>`);
      }
      continue;
    }

    if (nextTag === TAG_ORIGINAL_SCOPE_START) {
      const child = decodeOriginalScopeTree(state);
      if (child) {
        scope.children.push(child);
      }
      continue;
    }

    // Unknown tag inside scope — skip it
    readUnsigned(state);
    state.index = skipToNextItem(state.input, state.index);
  }

  emitError(state, 'Unterminated original scope (missing end tag C)');
  return scope;
}

function decodeGeneratedRangeTree(state: DecoderState): DecodedGeneratedRange | null {
  // Read tag E
  const tag = readUnsigned(state);
  if (tag === null) return null;
  if (tag !== TAG_GENERATED_RANGE_START) {
    emitError(state, `Expected generated range start tag (E), got tag ${tag}`);
    state.index = skipToNextItem(state.input, state.index);
    return null;
  }

  const flags = readUnsigned(state);
  if (flags === null) return null;

  let relLine = 0;
  if (flags & RANGE_HAS_LINE) {
    const lineVal = readUnsigned(state);
    if (lineVal === null) return null;
    relLine = lineVal;
  }
  const relCol = readUnsigned(state);
  if (relCol === null) return null;
  const start = accumulatePosition(state, 'range', relLine, relCol);

  let definition: number | undefined;
  if (flags & RANGE_HAS_DEFINITION) {
    const defRel = readSigned(state);
    if (defRel === null) return null;
    state.relDefinition += defRel;
    definition = state.relDefinition;
  }

  const isStackFrame = (flags & RANGE_IS_STACK_FRAME) !== 0;
  const isHidden = (flags & RANGE_IS_HIDDEN) !== 0;

  const range: DecodedGeneratedRange = {
    start,
    end: { line: 0, column: 0 },
    isStackFrame,
    isHidden,
    bindings: [],
    children: [],
  };
  if (definition !== undefined) range.definition = definition;

  // Read children, bindings, callsite until we hit tag F (end)
  while (state.index < state.input.length) {
    consumeComma(state);
    if (state.index >= state.input.length) break;

    const nextTag = peekTag(state);
    if (nextTag === null) break;

    if (nextTag === TAG_GENERATED_RANGE_END) {
      readUnsigned(state); // consume tag F

      const vals: number[] = [];
      while (!atItemBoundary(state)) {
        const v = readUnsigned(state);
        if (v === null) break;
        vals.push(v);
      }

      if (vals.length === 2) {
        range.end = accumulatePosition(state, 'range', vals[0]!, vals[1]!);
      } else if (vals.length === 1) {
        range.end = accumulatePosition(state, 'range', 0, vals[0]!);
      } else if (vals.length === 0) {
        emitError(state, 'Generated range end tag (F) missing column value');
      }

      return range;
    }

    if (nextTag === TAG_GENERATED_RANGE_CALLSITE) {
      readUnsigned(state); // consume tag I
      const sourceIdx = readUnsigned(state);
      const line = readUnsigned(state);
      const col = readUnsigned(state);
      if (sourceIdx !== null && line !== null && col !== null) {
        range.callsite = { sourceIndex: sourceIdx, line, column: col };
      }
      continue;
    }

    if (nextTag === TAG_GENERATED_RANGE_BINDINGS) {
      readUnsigned(state); // consume tag G
      while (!atItemBoundary(state)) {
        const bindingVal = readUnsigned(state);
        if (bindingVal === null) break;
        const binding: DecodedBinding = {
          type: 'simple',
          expression: bindingVal === 0 ? undefined : resolveName(state, bindingVal - 1),
        };
        range.bindings.push(binding);
      }
      continue;
    }

    if (nextTag === TAG_GENERATED_RANGE_SUBRANGE_BINDING) {
      readUnsigned(state); // consume tag H
      const varIndex = readUnsigned(state);
      if (varIndex === null) continue;
      const bindingRanges: DecodedBindingRange[] = [];
      let accLine = range.start.line;
      let accCol = range.start.column;
      while (!atItemBoundary(state)) {
        const relLine = readUnsigned(state);
        if (relLine === null) break;
        const relCol = readUnsigned(state);
        if (relCol === null) break;
        const bindingVal = readUnsigned(state);
        if (bindingVal === null) break;
        accLine += relLine;
        if (relLine === 0) {
          accCol += relCol;
        } else {
          accCol = relCol;
        }
        bindingRanges.push({
          from: { line: accLine, column: accCol },
          expression: bindingVal === 0 ? undefined : resolveName(state, bindingVal - 1),
        });
      }
      range.bindings.push({ type: 'subrange', variableIndex: varIndex, ranges: bindingRanges });
      continue;
    }

    if (nextTag === TAG_GENERATED_RANGE_START) {
      const child = decodeGeneratedRangeTree(state);
      if (child) {
        range.children.push(child);
      }
      continue;
    }

    // Unknown tag — skip
    readUnsigned(state);
    state.index = skipToNextItem(state.input, state.index);
  }

  emitError(state, 'Unterminated generated range (missing end tag F)');
  return range;
}

export function decodeScopes(input: string, names: string[]): ScopesDecodeResult {
  const state: DecoderState = {
    index: 0,
    input,
    names,
    diagnostics: [],
    relName: 0,
    relKind: 0,
    relVariable: 0,
    relDefinition: 0,
    scopeLine: 0,
    scopeColumn: 0,
    relGenLine: 0,
    relGenColumn: 0,
  };

  const originalScopes: (DecodedOriginalScope | null)[] = [];
  const generatedRanges: DecodedGeneratedRange[] = [];

  if (input.length === 0) {
    return { scopes: { originalScopes, generatedRanges }, diagnostics: [] };
  }

  // Phase 1: Parse original scope trees.
  // They come first, one per source. Empty items (consecutive commas or leading comma)
  // represent sources with no scope info.
  while (state.index < state.input.length) {
    // Check for empty slot (comma at current position = null scope for this source)
    if (state.input[state.index] === ',') {
      originalScopes.push(null);
      state.index++;
      continue;
    }

    const nextTag = peekTag(state);

    if (nextTag === null) {
      // Can't decode tag — emit error and bail out of parsing
      emitError(state, 'Failed to decode tag in scopes string');
      state.index = skipToNextItem(state.input, state.index);
      consumeComma(state);
      break;
    }

    // EmptyItem: tag 0 ('A') means null scope for this source
    if (nextTag === 0) {
      readUnsigned(state); // consume tag A
      originalScopes.push(null);
      consumeComma(state);
      continue;
    }

    // If we hit a generated range start tag, we're done with original scopes
    if (nextTag === TAG_GENERATED_RANGE_START) {
      break;
    }

    if (nextTag === TAG_ORIGINAL_SCOPE_START) {
      state.scopeLine = 0;
      state.scopeColumn = 0;
      const scope = decodeOriginalScopeTree(state);
      originalScopes.push(scope);
      consumeComma(state);
      continue;
    }

    // Unknown top-level tag — skip
    readUnsigned(state);
    state.index = skipToNextItem(state.input, state.index);
    consumeComma(state);
  }

  // Phase 2: Parse generated range trees
  while (state.index < state.input.length) {
    if (state.input[state.index] === ',') {
      state.index++;
      continue;
    }

    const nextTag = peekTag(state);
    if (nextTag === null) {
      emitError(state, 'Failed to decode tag in scopes string');
      state.index = skipToNextItem(state.input, state.index);
      consumeComma(state);
      break;
    }

    if (nextTag === TAG_GENERATED_RANGE_START) {
      const range = decodeGeneratedRangeTree(state);
      if (range) {
        generatedRanges.push(range);
      }
      consumeComma(state);
      continue;
    }

    // Unknown top-level tag — skip
    readUnsigned(state);
    state.index = skipToNextItem(state.input, state.index);
    consumeComma(state);
  }

  return {
    scopes: { originalScopes, generatedRanges },
    diagnostics: state.diagnostics,
  };
}
