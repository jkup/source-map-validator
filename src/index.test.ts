import assert from "node:assert";
import { test } from "node:test";

import validateSourceMap from "./index.js";

const projects = ["project1", "project2", "project3", "project5"];

test.describe("validateSourceMap", () => {
  projects.forEach((project) => {
    test(`should return a valid result when given a valid source map for js project with name "${project}"`, async () => {
      const foo = await validateSourceMap([
        "--sourceMap",
        `test-projects/${project}/${project}.js.map`,
        "--generatedFile",
        `test-projects/${project}/${project}.generated.js`,
        "--originalFolder",
        `test-projects/${project}/original/`,
      ]);
      assert.deepEqual(foo, { isValid: true, errors: [] });
    });
  });
  test(`should return a valid result when given a valid source map for wasm project with name "project4"`, async () => {
    const foo = await validateSourceMap([
      "--sourceMap",
      `test-projects/project4/project4.generated.wasm.map`,
      "--generatedFile",
      `test-projects/project4/project4.generated.wasm`,
      "--originalFolder",
      `test-projects/project4/original/`,
    ]);
    assert.deepEqual(foo, { isValid: true, errors: [] });
  });
});
