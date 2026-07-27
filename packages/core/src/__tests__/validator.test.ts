import { describe, it, expect } from 'vitest';
import { validate } from '../validator.js';

// Helper to make a valid source map JSON string
function makeMap(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 3,
    sources: ['source.js'],
    names: [],
    mappings: 'AAAA',
    ...overrides,
  });
}

describe('validate()', () => {
  describe('Level 1 — Format Validation', () => {
    it('accepts a minimal valid source map', () => {
      const result = validate({ sourceMap: makeMap() });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid JSON', () => {
      const result = validate({ sourceMap: '{bad json' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((d) => d.rule === 'valid-json')).toBe(true);
    });

    it('rejects wrong version', () => {
      const result = validate({ sourceMap: makeMap({ version: 2 }) });
      expect(result.valid).toBe(false);
      expect(result.errors.some((d) => d.rule === 'version-field')).toBe(true);
    });

    it('rejects version as string "3"', () => {
      const result = validate({ sourceMap: makeMap({ version: '3' }) });
      expect(result.valid).toBe(false);
      expect(result.errors.some((d) => d.rule === 'version-field')).toBe(true);
    });

    it('rejects missing sources field', () => {
      const json = JSON.stringify({ version: 3, mappings: 'AAAA' });
      const result = validate({ sourceMap: json });
      expect(result.errors.some((d) => d.rule === 'required-fields')).toBe(true);
    });

    it('rejects missing mappings field', () => {
      const json = JSON.stringify({
        version: 3,
        sources: ['a.js'],
      });
      const result = validate({ sourceMap: json });
      expect(result.errors.some((d) => d.rule === 'required-fields')).toBe(true);
    });

    it('rejects wrong type for sources', () => {
      const result = validate({
        sourceMap: makeMap({ sources: 'not-array' }),
      });
      expect(result.errors.some((d) => d.rule === 'field-types')).toBe(true);
    });

    it('rejects wrong type for names entries', () => {
      const result = validate({
        sourceMap: makeMap({ names: [42] }),
      });
      expect(result.errors.some((d) => d.rule === 'field-types')).toBe(true);
    });

    it('rejects sourcesContent/sources length mismatch', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js', 'b.js'],
          sourcesContent: ['content-a'],
        }),
      });
      expect(result.errors.some((d) => d.rule === 'sources-content-length')).toBe(true);
    });

    it('accepts matching sourcesContent length', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          sourcesContent: ['content'],
        }),
      });
      expect(result.errors.filter((d) => d.rule === 'sources-content-length')).toHaveLength(0);
    });

    it('rejects ignoreList with out-of-bounds index', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          ignoreList: [5],
        }),
      });
      expect(result.errors.some((d) => d.rule === 'ignore-list-bounds')).toBe(true);
    });

    it('warns about duplicate ignoreList entries', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js', 'b.js'],
          ignoreList: [0, 0],
        }),
      });
      expect(result.warnings.some((d) => d.rule === 'ignore-list-bounds')).toBe(true);
    });

    it('rejects invalid VLQ characters in mappings', () => {
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAA!A' }),
      });
      expect(result.errors.some((d) => d.rule === 'vlq-valid')).toBe(true);
    });

    it('reports mapping with out-of-bounds source index', () => {
      // ACAA means source index +1, but we only have 1 source (index 0)
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          mappings: 'ACAA',
        }),
      });
      expect(result.errors.some((d) => d.rule === 'mapping-index-bounds')).toBe(true);
    });

    it('detects non-ascending columns on same line', () => {
      // AAAA,AAAA = two segments on same line, both at column 0
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA,AAAA' }),
      });
      expect(result.warnings.some((d) => d.rule === 'column-ordering')).toBe(true);
    });

    it('accepts ascending columns on same line', () => {
      // AAAA,GCAA = col 0 then col 3 (C=1 shifted left, G=3)
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA,GAAA' }),
      });
      expect(result.warnings.filter((d) => d.rule === 'column-ordering')).toHaveLength(0);
    });

    it('detects negative original line', () => {
      // Second segment: AADA = col+0, src+0, origLine + (-1), origCol+0
      // After AAAA (origLine=0), AADA makes origLine = -1
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA,AADA' }),
      });
      expect(result.errors.some((d) => d.rule === 'non-negative-positions')).toBe(true);
    });

    it('detects negative source index', () => {
      // Second segment: ADAA = col+0, src+(-1), origLine+0, origCol+0
      // After AAAA (src=0), ADAA makes src = -1
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA,ADAA' }),
      });
      expect(result.errors.some((d) => d.rule === 'non-negative-positions')).toBe(true);
    });

    it('detects index map with both sections and mappings', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [],
        mappings: '',
        sources: [],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) => d.rule === 'index-map-valid' && d.message.includes('`sections` and `mappings`'),
        ),
      ).toBe(true);
    });

    it('detects index map with both sections and sources', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [],
        sources: ['a.js'],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) => d.rule === 'index-map-valid' && d.message.includes('`sections` and `sources`'),
        ),
      ).toBe(true);
    });

    it('rejects non-object section entries', () => {
      const json = JSON.stringify({
        version: 3,
        sections: ['not-an-object'],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'index-map-valid' &&
            d.message.includes('sections[0]') &&
            d.message.includes('not an object'),
        ),
      ).toBe(true);
    });

    it('rejects section with missing offset', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [{ map: { version: 3, sources: [], mappings: '' } }],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'index-map-valid' &&
            d.message.includes('offset') &&
            d.message.includes('missing'),
        ),
      ).toBe(true);
    });

    it('rejects section offset with non-numeric line/column', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 'zero', column: 0 },
            map: { version: 3, sources: [], mappings: '' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some((d) => d.rule === 'index-map-valid' && d.message.includes('numeric')),
      ).toBe(true);
    });

    it('rejects section with negative offset values', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: -1, column: 0 },
            map: { version: 3, sources: [], mappings: '' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some((d) => d.rule === 'index-map-valid' && d.message.includes('negative')),
      ).toBe(true);
    });

    it('rejects section with missing map', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [{ offset: { line: 0, column: 0 } }],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'index-map-valid' &&
            d.message.includes('map') &&
            d.message.includes('missing'),
        ),
      ).toBe(true);
    });

    it('rejects sections not sorted by offset', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 10, column: 0 },
            map: { version: 3, sources: [], mappings: '' },
          },
          {
            offset: { line: 5, column: 0 },
            map: { version: 3, sources: [], mappings: '' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some((d) => d.rule === 'index-map-valid' && d.message.includes('not after')),
      ).toBe(true);
    });

    it('rejects sections with equal offsets', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: { version: 3, sources: [], mappings: '' },
          },
          {
            offset: { line: 0, column: 0 },
            map: { version: 3, sources: [], mappings: '' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some((d) => d.rule === 'index-map-valid' && d.message.includes('not after')),
      ).toBe(true);
    });

    it('accepts valid sorted sections', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: { version: 3, sources: ['a.js'], mappings: 'AAAA' },
          },
          {
            offset: { line: 10, column: 0 },
            map: { version: 3, sources: ['b.js'], mappings: 'AAAA' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(result.errors.filter((d) => d.rule === 'index-map-valid')).toHaveLength(0);
    });

    it('recursively validates sub-map with invalid version', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: { version: 2, sources: ['a.js'], mappings: 'AAAA' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'version-field' &&
            d.message.includes('sections[0].map:'),
        ),
      ).toBe(true);
    });

    it('recursively validates sub-map with invalid sources type', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: { version: 3, sources: 'not-an-array', mappings: '' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'field-types' &&
            d.message.includes('sections[0].map:') &&
            d.message.includes('sources'),
        ),
      ).toBe(true);
    });

    it('recursively validates sub-map with malformed VLQ mappings', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: { version: 3, sources: ['a.js'], mappings: '!!!' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'vlq-valid' &&
            d.message.includes('sections[0].map:'),
        ),
      ).toBe(true);
    });

    it('produces no extra errors for valid sub-maps', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: { version: 3, sources: ['a.js'], names: [], mappings: 'AAAA' },
          },
          {
            offset: { line: 10, column: 0 },
            map: { version: 3, sources: ['b.js'], names: [], mappings: 'AAAA' },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      const subMapErrors = result.errors.filter((d) => d.message.includes('sections['));
      expect(subMapErrors).toHaveLength(0);
    });

    it('recursively validates nested index maps', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: {
              version: 3,
              sections: [
                {
                  offset: { line: 0, column: 0 },
                  map: { version: 2, sources: ['a.js'], mappings: 'AAAA' },
                },
              ],
            },
          },
        ],
      });
      const result = validate({ sourceMap: json });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'version-field' &&
            d.message.includes('sections[0].map: sections[0].map:'),
        ),
      ).toBe(true);
    });

    it('propagates rule overrides to sub-map validation', () => {
      const json = JSON.stringify({
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: { version: 2, sources: ['a.js'], mappings: 'AAAA' },
          },
        ],
      });
      const result = validate({
        sourceMap: json,
        rules: { 'version-field': false },
      });
      expect(
        result.diagnostics.some(
          (d) =>
            d.rule === 'version-field' &&
            d.message.includes('sections[0].map:'),
        ),
      ).toBe(false);
    });
  });

  describe('Level 2 — Generated File Validation', () => {
    it('warns about missing sourceMappingURL', () => {
      const result = validate({
        sourceMap: makeMap(),
        generatedSource: 'var x = 1;\n',
      });
      expect(result.warnings.some((d) => d.rule === 'source-mapping-url')).toBe(true);
    });

    it('does not warn when sourceMappingURL is present', () => {
      const result = validate({
        sourceMap: makeMap(),
        generatedSource: 'var x = 1;\n//# sourceMappingURL=test.js.map\n',
      });
      expect(result.warnings.filter((d) => d.rule === 'source-mapping-url')).toHaveLength(0);
    });

    it('detects mappings beyond generated file line count', () => {
      // The map has AAAA on line 1, then a mapping on line 2 via semicolon
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA;AAAA;AAAA' }),
        generatedSource: 'x\n',
      });
      // 3 mapping lines but file only has 2 lines (including the trailing empty)
      expect(result.errors.some((d) => d.rule === 'mappings-in-generated-bounds')).toBe(true);
    });

    it('accepts mappings exactly at generated line boundary', () => {
      // 'x' is 1 code unit; mapping at column 1 (one past last char) is valid
      const result = validate({
        sourceMap: makeMap({ mappings: 'CAAA' }), // column 1
        generatedSource: 'x\n//# sourceMappingURL=test.js.map\n',
      });
      expect(result.errors.filter((d) => d.rule === 'mappings-in-generated-bounds')).toHaveLength(
        0,
      );
    });

    it('detects mapping column beyond generated line length', () => {
      // 'x' is 1 code unit, so column 2 is out of bounds
      const result = validate({
        sourceMap: makeMap({ mappings: 'EAAA' }), // column 2
        generatedSource: 'x\n//# sourceMappingURL=test.js.map\n',
      });
      expect(result.errors.some((d) => d.rule === 'mappings-in-generated-bounds')).toBe(true);
    });

    it('validates mappings across multi-line generated files', () => {
      // 3 lines of generated code, mappings on all 3 lines — should be fine
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA;AAAA;AAAA' }),
        generatedSource: 'line1\nline2\nline3\n//# sourceMappingURL=test.js.map\n',
      });
      expect(result.errors.filter((d) => d.rule === 'mappings-in-generated-bounds')).toHaveLength(
        0,
      );
    });

    it('recognizes CSS sourceMappingURL comment', () => {
      const result = validate({
        sourceMap: makeMap(),
        generatedSource: '.a{color:red}\n/*# sourceMappingURL=test.css.map */\n',
      });
      expect(result.warnings.filter((d) => d.rule === 'source-mapping-url')).toHaveLength(0);
    });

    it('warns on empty sourceMappingURL value', () => {
      const result = validate({
        sourceMap: makeMap(),
        generatedSource: 'var x = 1;\n//# sourceMappingURL=\n',
      });
      expect(
        result.warnings.some((d) => d.rule === 'source-mapping-url' && d.message.includes('empty')),
      ).toBe(true);
    });

    it('computes coverage', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          mappings: 'AAAA',
        }),
        generatedSource: 'var x = 1;\n',
      });
      expect(result.coverage).toBeDefined();
      expect(result.coverage!.coveragePercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('WASM binary file support', () => {
    it('accepts WASM mappings on line 1 within byte bounds', () => {
      const wasmBytes = '\x00\x61\x73\x6d\x01\x00\x00\x00'; // 8 bytes
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA,KAAA' }), // col 0 and col 5
        generatedSource: wasmBytes,
        generatedFileType: 'wasm',
      });
      expect(
        result.errors.filter((d) => d.rule === 'mappings-in-generated-bounds'),
      ).toHaveLength(0);
    });

    it('rejects WASM mappings on line 2', () => {
      const wasmBytes = '\x00\x61\x73\x6d\x01\x00\x00\x00';
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA;AAAA' }), // second mapping on line 2
        generatedSource: wasmBytes,
        generatedFileType: 'wasm',
      });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'mappings-in-generated-bounds' &&
            d.message.includes('WASM') &&
            d.message.includes('line 1'),
        ),
      ).toBe(true);
    });

    it('rejects WASM mapping with byte offset exceeding file size', () => {
      const wasmBytes = '\x00\x61\x73\x6d'; // 4 bytes
      const result = validate({
        sourceMap: makeMap({ mappings: 'KAAA' }), // col 5, beyond 4 bytes
        generatedSource: wasmBytes,
        generatedFileType: 'wasm',
      });
      expect(
        result.errors.some(
          (d) =>
            d.rule === 'mappings-in-generated-bounds' &&
            d.message.includes('byte offset') &&
            d.message.includes('4 bytes'),
        ),
      ).toBe(true);
    });

    it('computes WASM coverage as byte-based', () => {
      const wasmBytes = '\x00'.repeat(10); // 10 bytes
      const result = validate({
        sourceMap: makeMap({
          sources: ['module.wat'],
          mappings: 'AAAA,GAAA', // col 0 and col 3, both with source
        }),
        generatedSource: wasmBytes,
        generatedFileType: 'wasm',
      });
      expect(result.coverage).toBeDefined();
      expect(result.coverage!.totalCharacters).toBe(10);
    });

    it('text mode is unaffected by WASM support', () => {
      const result = validate({
        sourceMap: makeMap({ mappings: 'AAAA;AAAA' }),
        generatedSource: 'line1\nline2\n',
      });
      expect(
        result.errors.filter((d) => d.rule === 'mappings-in-generated-bounds'),
      ).toHaveLength(0);
    });
  });

  describe('Level 3 — Deep Validation', () => {
    it('detects original position out of bounds via sourcesContent', () => {
      // Map that points to line 10 in a source that only has 1 line
      // We need to craft a VLQ where originalLine is large.
      // AAAA = source 0, origLine 0, origCol 0. That's in bounds.
      // Let's test with sourcesContent that's shorter.
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          sourcesContent: ['single line'],
          // Using AASA: col=0, source=0, origLine=9, origCol=0
          mappings: 'AASA',
        }),
        generatedSource: 'var x = 1;\n',
      });
      expect(result.errors.some((d) => d.rule === 'mappings-in-original-bounds')).toBe(true);
    });

    it('detects token mismatch on named mapping', () => {
      // AAAAA = col 0, src 0, origLine 0, origCol 0, name 0
      // name[0] = "foo" but source token at (0,0) is "bar"
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          sourcesContent: ['bar = 1;'],
          names: ['foo'],
          mappings: 'AAAAA',
        }),
        generatedSource: 'bar = 1;\n//# sourceMappingURL=test.js.map\n',
      });
      expect(result.warnings.some((d) => d.rule === 'token-matching')).toBe(true);
    });

    it('accepts matching named mapping token', () => {
      // AAAAA = col 0, src 0, origLine 0, origCol 0, name 0
      // name[0] = "foo" and source token at (0,0) is "foo"
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          sourcesContent: ['foo = 1;'],
          names: ['foo'],
          mappings: 'AAAAA',
        }),
        generatedSource: 'foo = 1;\n//# sourceMappingURL=test.js.map\n',
      });
      expect(result.warnings.filter((d) => d.rule === 'token-matching')).toHaveLength(0);
    });

    it('detects sourcesContent/file mismatch', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js'],
          sourcesContent: ['original content'],
          mappings: 'AAAA',
        }),
        generatedSource: 'var x = 1;\n//# sourceMappingURL=test.js.map\n',
        originalSources: { 'a.js': 'different content' },
      });
      expect(result.warnings.some((d) => d.rule === 'sources-content-consistency')).toBe(true);
    });
  });

  describe('Level 4 — Advisory', () => {
    it('warns about absolute paths in sources', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['/Users/dev/project/src/app.js'],
        }),
      });
      expect(result.warnings.some((d) => d.rule === 'no-absolute-paths')).toBe(true);
    });

    it('warns about backslash paths', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['src\\app.js'],
        }),
      });
      expect(result.warnings.some((d) => d.rule === 'no-backslash-paths')).toBe(true);
    });

    it('warns about missing sourcesContent', () => {
      const result = validate({
        sourceMap: makeMap(),
      });
      expect(result.warnings.some((d) => d.rule === 'has-sources-content')).toBe(true);
    });

    it('suggests ignoreList for node_modules sources', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['node_modules/lib/index.js', 'src/app.js'],
          sourcesContent: ['lib', 'app'],
        }),
      });
      expect(result.infos.some((d) => d.rule === 'has-ignore-list')).toBe(true);
    });

    it('reports deprecated x_google_ignoreList', () => {
      const result = validate({
        sourceMap: makeMap({
          x_google_ignoreList: [0],
          sources: ['a.js'],
          sourcesContent: ['x'],
        }),
      });
      expect(result.infos.some((d) => d.rule === 'deprecated-x-google')).toBe(true);
    });

    it('reports extension fields', () => {
      const result = validate({
        sourceMap: makeMap({
          x_custom_field: true,
          sourcesContent: ['x'],
        }),
      });
      expect(result.infos.some((d) => d.rule === 'extension-fields')).toBe(true);
    });

    it('warns about unresolvable sources', () => {
      const result = validate({
        sourceMap: makeMap({ sources: ['a.js', 'b.js'] }),
      });
      const warnings = result.warnings.filter((d) => d.rule === 'sources-resolvable');
      expect(warnings).toHaveLength(2);
      expect(warnings[0].message).toContain('a.js');
      expect(warnings[1].message).toContain('b.js');
    });

    it('does not warn when sourcesContent covers all sources', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js', 'b.js'],
          sourcesContent: ['content-a', 'content-b'],
        }),
      });
      expect(result.warnings.filter((d) => d.rule === 'sources-resolvable')).toHaveLength(0);
    });

    it('does not warn when originalSources covers all sources', () => {
      const result = validate({
        sourceMap: makeMap({ sources: ['a.js'] }),
        originalSources: { 'a.js': 'content-a' },
      });
      expect(result.warnings.filter((d) => d.rule === 'sources-resolvable')).toHaveLength(0);
    });

    it('skips null source entries', () => {
      const result = validate({
        sourceMap: makeMap({ sources: [null, 'a.js'], sourcesContent: [null, 'content'] }),
      });
      expect(result.warnings.filter((d) => d.rule === 'sources-resolvable')).toHaveLength(0);
    });

    it('warns only for unresolvable sources in a mix', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js', 'b.js', 'c.js'],
          sourcesContent: ['content-a', null, null],
        }),
        originalSources: { 'b.js': 'content-b' },
      });
      const warnings = result.warnings.filter((d) => d.rule === 'sources-resolvable');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('c.js');
    });

    it('sources-resolvable can be disabled', () => {
      const result = validate({
        sourceMap: makeMap({ sources: ['a.js'] }),
        rules: { 'sources-resolvable': false },
      });
      expect(result.warnings.filter((d) => d.rule === 'sources-resolvable')).toHaveLength(0);
    });
  });

  describe('Feature flags', () => {
    it('disables specific rules', () => {
      const result = validate({
        sourceMap: makeMap(),
        rules: { 'has-sources-content': false },
      });
      expect(result.warnings.filter((d) => d.rule === 'has-sources-content')).toHaveLength(0);
    });

    it('strict preset upgrades warnings to errors', () => {
      const result = validate({
        sourceMap: makeMap(),
        preset: 'strict',
      });
      // has-sources-content is normally a warning, strict makes it an error
      expect(result.errors.some((d) => d.rule === 'has-sources-content')).toBe(true);
    });

    it('minimal preset disables advisory rules', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['/Users/dev/src/app.js'],
        }),
        preset: 'minimal',
      });
      // no-absolute-paths should be disabled
      expect(result.warnings.filter((d) => d.rule === 'no-absolute-paths')).toHaveLength(0);
    });
  });

  describe('Stats', () => {
    it('computes correct stats', () => {
      const result = validate({
        sourceMap: makeMap({
          sources: ['a.js', 'b.js'],
          names: ['foo', 'bar'],
          sourcesContent: ['a', 'b'],
          ignoreList: [0],
          mappings: 'AAAA,CACAC',
        }),
      });
      expect(result.stats.sourceCount).toBe(2);
      expect(result.stats.nameCount).toBe(2);
      expect(result.stats.hasSourcesContent).toBe(true);
      expect(result.stats.hasIgnoreList).toBe(true);
      expect(result.stats.mappingCount).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('handles )]}\\n prefix (JSON hijacking protection)', () => {
      const jsonWithPrefix =
        ")]}'\n" +
        JSON.stringify({
          version: 3,
          sources: ['a.js'],
          names: [],
          mappings: 'AAAA',
        });
      const result = validate({ sourceMap: jsonWithPrefix });
      expect(result.valid).toBe(true);
    });

    it('handles BOM prefix', () => {
      const result = validate({
        sourceMap: '\uFEFF' + makeMap(),
      });
      // Should parse successfully (BOM is stripped)
      expect(result.stats.mappingCount).toBeGreaterThanOrEqual(0);
    });

    it('handles empty mappings string', () => {
      const result = validate({
        sourceMap: makeMap({ mappings: '' }),
      });
      expect(result.valid).toBe(true);
      expect(result.stats.mappingCount).toBe(0);
    });
  });
});
