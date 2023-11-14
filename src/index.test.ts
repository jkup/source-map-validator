import assert from "node:assert";
import { test } from "node:test";
import path from "node:path";

import validateSourceMap from "./index";

const projects = ["project1", "project2", "project3"];

test.describe("validateSourceMap", () => {
  projects.forEach((project) => {
    test(`should return a valid result when given a valid source map for ${project}`, async () => {
      const foo = await validateSourceMap([
        "--sourceMap",
        `test-projects/${project}/${project}.js.map`,
        "--generatedFile",
        `test-projects/${project}/${project}.generated.js`,
        "--originalFolder",
        `test-projects/${project}/original/`,
      ]);
      assert.deepEqual(foo, {
        result: true,
        message: "Source map is valid.",
      });
    });
  });
});
