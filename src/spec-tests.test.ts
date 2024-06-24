import assert from "node:assert";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import validateSourceMap from "./index.js";
import sourceMapSpecTests from "../source-map-tests/source-map-spec-tests.json" assert { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specResourcesBaseDir = path.resolve(
  __dirname,
  "../../source-map-tests/resources"
);

// These tests are known failures that aren't easily fixed at the moment.
const skippedTests = [
  // Source maps library does not consider this a parse error.
  "invalidMappingSegmentWithZeroFields",
  // Source maps library ignores the sign bit in the size limit.
  "invalidMappingSegmentWithColumnExceeding32Bits",
  // This one has a valid format, but out of range values for the source.
  "validMappingFieldsWith32BitMaxValues",
  // Source maps library errors on this.
  "validMappingLargeVLQ",
];

test.describe("runSourceMapSpecTests", () => {
  sourceMapSpecTests.tests.forEach((testCase) => {
    test(`The source map spec test case "${testCase.name}" has ${
      testCase.sourceMapIsValid ? "a valid" : "an invalid"
    } source map`, async (t) => {
      if (skippedTests.includes(testCase.name)) {
        t.skip();
        return;
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
        assert.deepEqual(
          result,
          { isValid: true },
          "expected source map to be valid"
        );
      else
        assert.equal(
          result.isValid,
          false,
          "expected source map to be invalid"
        );
    });
  });
});
