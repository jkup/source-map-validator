import fs from "fs";
import { SourceMapConsumer } from "source-map";
import babelParser from "@babel/parser";

import { parseSourceFiles } from "../util/parseSourceFiles.mjs";

export async function validateSourceMapMappings(
  sourceMap,
  originalFolderPath,
  generatedFilePath
) {
  try {
    // Parse original files
    const originalFilesASTs = parseSourceFiles(originalFolderPath);

    // Parse generated file
    const generatedCode = fs.readFileSync(generatedFilePath, "utf8");
    const generatedAST = babelParser.parse(generatedCode, {
      sourceType: "module",
    });

    await SourceMapConsumer.with(sourceMap, null, (consumer) => {
      consumer.eachMapping((mapping) => {
        // console.log(mapping);
        // Add validation logic here
      });
    });

    console.log("Mappings validation completed.");
  } catch (err) {
    console.error("Error in mapping validation: ", err.message);
  }
}
