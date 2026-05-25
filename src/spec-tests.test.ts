import assert from "node:assert";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from 'node:url';

import validateSourceMap from "./index.js";
import sourceMapSpecTests from "../source-map-tests/source-map-spec-tests.json" with { type: "json" };
import rangeMappingsTests from "../source-map-tests/range-mappings-proposal-tests.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// These tests are known failures that aren't easily fixed at the moment.
const knownFailures = [
  // Source maps library does not consider this a parse error.
  "invalidMappingSegmentWithZeroFields",
  // Source maps library ignores the sign bit in the size limit.
  "invalidMappingSegmentWithColumnExceeding32Bits",
  // This one has a valid format, but out of range values for the source.
  "validMappingFieldsWith32BitMaxValues",
  // Source maps library errors on this.
  "validMappingLargeVLQ",
  // This test requires fully parsing the mappings in the range mappings
  // validator which we currently avoid doing.
  "rangeMappingsInvalidMappingForRange",
];

function runSpecTests(specification : any) {
  const specResourcesBaseDir = path.resolve(__dirname, "../../source-map-tests/resources/" + (specification.resourceBasePath || ""));

  specification.tests.forEach((testCase : any) => {
    test(`The source map spec test case "${testCase.name}" has ${testCase.sourceMapIsValid ? "a valid" : "an invalid"} source map`, async (t) => {
      if (knownFailures.includes(testCase.name)) {
        t.todo("This test has a known failure and doesn't fail the test suite");
      }
      const result = await validateSourceMap([
        "--sourceMap",
        `${specResourcesBaseDir}/${testCase.sourceMapFile}`,
        "--generatedFile",
        `${specResourcesBaseDir}/${testCase.baseFile}`,
        "--originalFolder",
        `${specResourcesBaseDir}`,
      ]);
      if (testCase.sourceMapIsValid)
        assert.deepEqual(result, { isValid: true }, "expected source map to be valid");
      else {
        assert.equal(result.isValid, false, "expected source map to be invalid");
        if (!result.isValid && result.errors[0])
           t.diagnostic(result.errors[0].message);
      }
    });
  });
}

test.describe("runSourceMapSpecTests", () => {
  runSpecTests(sourceMapSpecTests);
});

test.describe("rangeMappingsProposalTests", () => {
  runSpecTests(rangeMappingsTests);
});
