import { describe, it, expect } from 'vitest';
import { decodeMappings } from '../decoder.js';

describe('VLQ Decoder', () => {
  it('decodes empty mappings', () => {
    const { mappings, diagnostics } = decodeMappings('');
    expect(mappings).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  it('decodes a single segment with 1 field (column only)', () => {
    // 'A' = 0 in Base64 VLQ (value 0, terminal)
    const { mappings, diagnostics } = decodeMappings('A');
    expect(diagnostics).toEqual([]);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toHaveLength(1);
    expect(mappings[0][0].generatedColumn).toBe(0);
    expect(mappings[0][0].sourceIndex).toBeUndefined();
  });

  it('decodes a segment with 4 fields', () => {
    // AAAA = column 0, source 0, original line 0, original column 0
    const { mappings, diagnostics } = decodeMappings('AAAA');
    expect(diagnostics).toEqual([]);
    expect(mappings[0][0]).toEqual({
      generatedColumn: 0,
      sourceIndex: 0,
      originalLine: 0,
      originalColumn: 0,
    });
  });

  it('decodes a segment with 5 fields', () => {
    // AAAAA = column 0, source 0, original line 0, original column 0, name 0
    const { mappings, diagnostics } = decodeMappings('AAAAA');
    expect(diagnostics).toEqual([]);
    expect(mappings[0][0]).toEqual({
      generatedColumn: 0,
      sourceIndex: 0,
      originalLine: 0,
      originalColumn: 0,
      nameIndex: 0,
    });
  });

  it('handles semicolons as line separators', () => {
    const { mappings, diagnostics } = decodeMappings('AAAA;AAAA');
    expect(diagnostics).toEqual([]);
    expect(mappings).toHaveLength(2);
    expect(mappings[0]).toHaveLength(1);
    expect(mappings[1]).toHaveLength(1);
  });

  it('handles empty lines (consecutive semicolons)', () => {
    const { mappings, diagnostics } = decodeMappings('AAAA;;;AAAA');
    expect(diagnostics).toEqual([]);
    expect(mappings).toHaveLength(4);
    expect(mappings[0]).toHaveLength(1);
    expect(mappings[1]).toHaveLength(0);
    expect(mappings[2]).toHaveLength(0);
    expect(mappings[3]).toHaveLength(1);
  });

  it('handles commas as segment separators', () => {
    const { mappings, diagnostics } = decodeMappings('AAAA,CACA');
    expect(diagnostics).toEqual([]);
    expect(mappings[0]).toHaveLength(2);
    // First segment: column 0
    expect(mappings[0][0].generatedColumn).toBe(0);
    // Second segment: column 0 + 1 = 1 (C = 1 in VLQ)
    expect(mappings[0][1].generatedColumn).toBe(1);
  });

  it('decodes positive values correctly', () => {
    // C = 1 (binary: 000010, value = 1, sign bit 0 → +1)
    const { mappings } = decodeMappings('CAAA');
    expect(mappings[0][0].generatedColumn).toBe(1);
  });

  it('decodes negative values correctly', () => {
    // First use a positive value, then go negative
    // CAAA = col 1; then DAAA = col 1 + (-1) = col 0
    // D = 3 in base64, VLQ: value=1, sign=1 → -1
    const { mappings } = decodeMappings('CAAA,DAAA');
    expect(mappings[0][0].generatedColumn).toBe(1);
    expect(mappings[0][1].generatedColumn).toBe(0);
  });

  it('resets generated column at line boundaries', () => {
    // After semicolon, generated column resets to 0
    const { mappings } = decodeMappings('CAAA;CAAA');
    expect(mappings[0][0].generatedColumn).toBe(1);
    // On new line, column is absolute again: C = 1
    expect(mappings[1][0].generatedColumn).toBe(1);
  });

  it('maintains relative state for source/line/col/name across lines', () => {
    // AAAAA on line 0: source=0, origLine=0, origCol=0, name=0
    // ;AACCA on line 1: source=0+0=0, origLine=0+1=1, origCol=0+1=1, name=0+0=0
    const { mappings } = decodeMappings('AAAAA;AACCA');
    expect(mappings[1][0].sourceIndex).toBe(0);
    expect(mappings[1][0].originalLine).toBe(1);
    expect(mappings[1][0].originalColumn).toBe(1);
    expect(mappings[1][0].nameIndex).toBe(0);
  });

  it('reports diagnostic for invalid segment field count', () => {
    // AA = 2 fields (invalid — must be 1, 4, or 5)
    const { diagnostics } = decodeMappings('AA');
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].rule).toBe('segment-field-count');
  });

  it('reports diagnostic for invalid characters', () => {
    const { diagnostics } = decodeMappings('AAA!A');
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('handles a realistic mappings string', () => {
    // A simple but real-ish mapping
    const { mappings, diagnostics } = decodeMappings('AAAA;AACA,EAAE;AACA');
    expect(diagnostics).toEqual([]);
    expect(mappings).toHaveLength(3);
  });
});
