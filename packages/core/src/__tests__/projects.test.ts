import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { validate } from '../validator.js';

const PROJECTS = path.resolve(__dirname, '../../../../test-fixtures/projects');

function readFixture(relativePath: string): string {
  return fs.readFileSync(path.join(PROJECTS, relativePath), 'utf-8');
}

function loadOriginalSources(projectDir: string): Record<string, string> {
  const dir = path.join(PROJECTS, projectDir, 'original');
  const sources: Record<string, string> = {};
  for (const file of fs.readdirSync(dir)) {
    sources[file] = fs.readFileSync(path.join(dir, file), 'utf-8');
  }
  return sources;
}

describe('real-world projects', () => {
  describe('vite-bundle', () => {
    const sourceMap = readFixture('vite-bundle/bundle.js.map');
    const generatedSource = readFixture('vite-bundle/generated.js');
    const originalSources = loadOriginalSources('vite-bundle');

    it('passes Level 1 format validation', () => {
      const result = validate({ sourceMap });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 2 generated-file validation', () => {
      const result = validate({ sourceMap, generatedSource });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 3 deep validation with original sources', () => {
      const result = validate({ sourceMap, generatedSource, originalSources });
      expect(result.errors).toHaveLength(0);
    });

    it('computes coverage', () => {
      const result = validate({ sourceMap, generatedSource });
      expect(result.coverage).toBeDefined();
      expect(result.coverage!.coveragePercent).toBeGreaterThan(0);
    });
  });

  describe('rollup-bundle', () => {
    const sourceMap = readFixture('rollup-bundle/bundle.js.map');
    const generatedSource = readFixture('rollup-bundle/generated.js');
    const originalSources = loadOriginalSources('rollup-bundle');

    it('passes Level 1 format validation', () => {
      const result = validate({ sourceMap });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 2 generated-file validation', () => {
      const result = validate({ sourceMap, generatedSource });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 3 deep validation with original sources', () => {
      const result = validate({ sourceMap, generatedSource, originalSources });
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('rspack-bundle', () => {
    const sourceMap = readFixture('rspack-bundle/bundle.js.map');
    const generatedSource = readFixture('rspack-bundle/generated.js');
    const originalSources = loadOriginalSources('rspack-bundle');

    it('passes Level 1 format validation', () => {
      const result = validate({ sourceMap });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 2 generated-file validation', () => {
      const result = validate({ sourceMap, generatedSource });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 3 deep validation with original sources', () => {
      const result = validate({ sourceMap, generatedSource, originalSources });
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('wasm-kotlin', () => {
    const sourceMap = readFixture('wasm-kotlin/generated.wasm.map');
    const generatedSource = fs.readFileSync(
      path.join(PROJECTS, 'wasm-kotlin/generated.wasm'),
      'latin1',
    );
    const originalSources = loadOriginalSources('wasm-kotlin');

    it('passes Level 1 format validation', () => {
      const result = validate({ sourceMap });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 2 validation with WASM generated file', () => {
      const result = validate({
        sourceMap,
        generatedSource,
        generatedFileType: 'wasm',
      });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 3 deep validation with original sources', () => {
      const result = validate({
        sourceMap,
        generatedSource,
        generatedFileType: 'wasm',
        originalSources,
      });
      expect(result.errors).toHaveLength(0);
    });

    it('computes coverage for WASM', () => {
      const result = validate({
        sourceMap,
        generatedSource,
        generatedFileType: 'wasm',
      });
      expect(result.coverage).toBeDefined();
      expect(result.coverage!.coveragePercent).toBeGreaterThan(0);
    });
  });

  describe('scopes', () => {
    const sourceMap = readFixture('scopes/bundle.js.map');
    const generatedSource = readFixture('scopes/generated.js');
    const originalSources = loadOriginalSources('scopes');

    it('passes Level 1 format validation', () => {
      const result = validate({ sourceMap });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 2 generated-file validation', () => {
      const result = validate({ sourceMap, generatedSource });
      expect(result.errors).toHaveLength(0);
    });

    it('passes Level 3 deep validation with original sources', () => {
      const result = validate({ sourceMap, generatedSource, originalSources });
      expect(result.errors).toHaveLength(0);
    });

    it('passes scopes proposal validation', () => {
      const result = validate({
        sourceMap,
        generatedSource,
        originalSources,
        proposals: ['scopes'],
      });
      expect(result.errors).toHaveLength(0);
    });
  });
});
