import { MappingItem, SourceMapConsumer } from "source-map";
import { Token } from "../util/token.js";
import { parseSourceFiles } from "../util/parseSourceFiles.js";
import { findTokenAtPosition } from "../util/findTokenAtPosition.js";
import { tokensMatch } from "../util/tokensMatch.js";
import { TestingFile } from "../util/TestingFile.js";
import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import type { ValidationContext } from "../util/ValidationContext.js";

export class SourceMapMappingsValidator extends Validator {
  async validate({ sourceMap, originalFolderPath, generatedFilePath }: ValidationContext): Promise<ValidationResult> {
    const errors: Error[] = [];
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

        if (originalFile === undefined) {
          errors.push(new Error(`There is no content for file with the path "${mapping.source}" on a disk or in the\`sourcesContent\` section`))
          return
        }

        const originalToken = findTokenAtPosition(
            originalFile.getAst().tokens,
            mapping.originalLine,
            mapping.originalColumn
        );

        // Compare the tokens to validate the mapping
        if (!tokensMatch(generatedToken, originalToken)) {
          errors.push(new Error(this.formatDifferentTokenMessage(mapping, originalFile, generatedFile, originalToken, generatedToken)));
        }
      });
    });

    return ValidationResult.from(errors);
  }

  private formatDifferentTokenMessage(
      mapping: MappingItem,
      originalFile: TestingFile,
      generatedFile: TestingFile,
      originalToken: Token | null,
      generatedToken: Token | null,
  ) {
    return ` 
Tokens in ${originalFile.path} (${mapping.originalLine}:${mapping.originalColumn}) and in ${generatedFile.path} (${mapping.generatedLine}:${mapping.generatedColumn}) are not equal.
* Original token is: ${originalToken?.type?.label}
* Generated token is: ${generatedToken?.type?.label}
    `.trim();
  }
}