import fs from "fs";
import { SourceMapConsumer } from "source-map";
import babelParser from "@babel/parser";

import { parseSourceFiles } from "../util/parseSourceFiles.mjs";
import { findTokenAtPosition } from "../util/findTokenAtPosition.mjs";
import { tokensMatch } from "../util/tokensMatch.mjs";

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
      tokens: true,
    });

    await SourceMapConsumer.with(sourceMap, null, (consumer) => {
      consumer.eachMapping((mapping) => {
        // Get the tokens list for the generated file
        const generatedToken = findTokenAtPosition(
          generatedAST.tokens,
          mapping.generatedLine,
          mapping.generatedColumn
        );

        // Get the tokens list for the original file
        const originalAST = originalFilesASTs.get(mapping.source);
        const originalToken = findTokenAtPosition(
          originalAST.tokens,
          mapping.originalLine,
          mapping.originalColumn
        );

        // Compare the tokens to validate the mapping
        if (!tokensMatch(generatedToken, originalToken)) {
          throw new Error("Tokens are not equal.");
        }
      });
    });

    console.log("Mappings validation completed.");
  } catch (err) {
    console.error("Error in mapping validation: ", err.message);
  }
}
