import { SourceMapConsumer } from "source-map";
import { parseSourceFiles } from "../util/parseSourceFiles";
import { findTokenAtPosition } from "../util/findTokenAtPosition";
import { tokensMatch } from "../util/tokensMatch";
import { TestingFile } from "../util/TestingFile";

export async function validateSourceMapMappings(
  sourceMap: any,
  originalFolderPath: string,
  generatedFilePath: string
) {
  // Parse original files
  const originalFiles = parseSourceFiles(originalFolderPath);
  // Parse generated file
  const generatedFile = TestingFile.fromPath(generatedFilePath)

  await SourceMapConsumer.with(sourceMap, null, (consumer) => {
    consumer.eachMapping((mapping) => {
      // Get the tokens list for the generated file
      const generatedToken = findTokenAtPosition(
        generatedFile.getAst().tokens,
        mapping.generatedLine,
        mapping.generatedColumn
      );

      // Get the tokens list for the original file
      const originalFile = originalFiles.get(mapping.source);
      const originalToken = findTokenAtPosition(
        originalFile.getAst().tokens,
        mapping.originalLine,
        mapping.originalColumn
      );

      // Compare the tokens to validate the mapping
      if (!tokensMatch(generatedToken, originalToken)) {
        console.log(generatedToken, originalToken);
        throw new Error("Tokens are not equal.");
      }
    });
  });
}
