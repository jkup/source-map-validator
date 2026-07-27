/**
 * TC39 source-map-tests conformance suite.
 *
 * Runs the official ECMA-426 spec tests from https://github.com/tc39/source-map-tests/
 * against our validator. Fixtures live in test-fixtures/spec-tests/ and are downloaded
 * by `npm run update-spec-tests`.
 *
 * These tests check source map FORMAT validity (Level 1) only. We intentionally
 * do not pass generatedSource because the spec tests don't assert anything about
 * mapping-to-generated-file correspondence.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '../validator.js';

const FIXTURES_DIR = join(__dirname, '..', '..', '..', '..', 'test-fixtures', 'spec-tests');
const MANIFEST_PATH = join(FIXTURES_DIR, 'source-map-spec-tests.json');

interface SpecTest {
  name: string;
  description: string;
  baseFile: string;
  sourceMapFile: string;
  sourceMapIsValid: boolean;
  testActions?: unknown[];
}

function readFixture(filename: string): string | undefined {
  const path = join(FIXTURES_DIR, filename);
  if (!existsSync(path)) return undefined;
  return readFileSync(path, 'utf-8');
}

// Known gaps: tests we can't pass yet due to missing features.
// Each entry should have a comment explaining why.
const KNOWN_GAPS = new Set([
  // Requires recursive validation of index map section contents (COMPETITOR.md P1)
  'indexMapInvalidSubMap',
]);

describe('TC39 spec conformance', () => {
  if (!existsSync(MANIFEST_PATH)) {
    it.skip('Fixtures not downloaded — run `npm run update-spec-tests` first', () => {});
    return;
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const tests: SpecTest[] = manifest.tests;

  const sampleMap = tests[0]?.sourceMapFile;
  if (sampleMap && !existsSync(join(FIXTURES_DIR, sampleMap))) {
    it.skip('Fixture files not downloaded — run `npm run update-spec-tests` first', () => {});
    return;
  }

  for (const spec of tests) {
    const testFn = KNOWN_GAPS.has(spec.name) ? it.skip : it;

    testFn(`${spec.name}: ${spec.description}`, () => {
      const sourceMap = readFixture(spec.sourceMapFile);
      expect(sourceMap, `Missing fixture: ${spec.sourceMapFile}`).toBeDefined();

      const result = validate({
        sourceMap: sourceMap!,
      });

      if (spec.sourceMapIsValid) {
        const errorMessages = result.errors.map(
          (e) => `[${e.rule}] ${e.message}`,
        );
        expect(
          result.valid,
          `Expected valid source map but got errors:\n${errorMessages.join('\n')}`,
        ).toBe(true);
      } else {
        expect(
          result.valid,
          `Expected invalid source map to produce errors but it passed`,
        ).toBe(false);
      }
    });
  }
});
