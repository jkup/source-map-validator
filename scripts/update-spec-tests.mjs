#!/usr/bin/env node

// Downloads the TC39 source-map-tests conformance suite into test-fixtures/spec-tests/.
// Re-run anytime to pull the latest version.
//
// Usage: node scripts/update-spec-tests.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'test-fixtures', 'spec-tests');
const BASE_URL = 'https://raw.githubusercontent.com/tc39/source-map-tests/main';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Fetching source-map-spec-tests.json ...');
  const manifestText = await fetchText(`${BASE_URL}/source-map-spec-tests.json`);
  const manifest = JSON.parse(manifestText);
  const tests = manifest.tests;
  if (!Array.isArray(tests)) {
    throw new Error('Expected { "tests": [...] } in source-map-spec-tests.json');
  }
  writeFileSync(join(OUT_DIR, 'source-map-spec-tests.json'), manifestText);

  const filesToFetch = new Set();
  for (const test of tests) {
    if (test.baseFile) filesToFetch.add(test.baseFile);
    if (test.sourceMapFile) filesToFetch.add(test.sourceMapFile);
    // Some tests reference original sources in testActions
    if (test.testActions) {
      for (const action of test.testActions) {
        if (action.originalSource) filesToFetch.add(action.originalSource);
      }
    }
  }

  console.log(`Downloading ${filesToFetch.size} fixture files ...`);
  let downloaded = 0;
  let failed = 0;

  for (const file of filesToFetch) {
    try {
      const content = await fetchText(`${BASE_URL}/resources/${file}`);
      writeFileSync(join(OUT_DIR, file), content);
      downloaded++;
    } catch {
      // Some referenced files may not exist (e.g., originals that are inline)
      failed++;
    }
  }

  console.log(`Done: ${tests.length} tests, ${downloaded} files downloaded${failed ? `, ${failed} skipped` : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
