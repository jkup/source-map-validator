import fs from "fs";
import { SourceMapConsumer } from "source-map";
import babelParser from "@babel/parser";

import { parseSourceFiles } from "../util/parseSourceFiles.mjs";
import { findNodeInAST } from "../util/findNodeInAST.mjs";
import { nodesAreEqual } from "../util/nodesAreEqual.mjs";

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
        // Find the corresponding node in the generated AST
        const generatedNode = findNodeInAST(
          generatedAST,
          mapping.generatedLine,
          mapping.generatedColumn
        );

        // Find the corresponding node in the original AST
        const originalAST = originalFilesASTs.get(mapping.source);
        const originalNode = findNodeInAST(
          originalAST,
          mapping.originalLine,
          mapping.originalColumn
        );

        // Compare the nodes to validate the mapping
        if (!nodesAreEqual(generatedNode, originalNode)) {
          throw new Error("Nodes are not equal.");
        }
      });
    });

    console.log("Mappings validation completed.");
  } catch (err) {
    console.error("Error in mapping validation: ", err.message);
  }
}
