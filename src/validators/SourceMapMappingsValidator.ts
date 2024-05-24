import { MappingItem, SourceMapConsumer } from "source-map";
import { collectSourceFiles } from "../util/collectSourceFiles.js";
import { TestingFile } from "../util/TestingFile.js";
import { Validator } from "../util/Validator.js";
import { ValidationResult } from "../util/ValidationResult.js";
import type { ValidationContext } from "../util/ValidationContext.js";

export class SourceMapMappingsValidator extends Validator {
  async validate({ sourceMap, originalFolderPath, generatedFilePath }: ValidationContext): Promise<ValidationResult> {
    const errors: Error[] = [];
    const generatedFile = TestingFile.fromPathBasedOnFileExtension(generatedFilePath);

    let originalFiles = new Map<string, TestingFile>();
    if (sourceMap.sections) {
      for (let section of sourceMap.sections) {
        const newOriginalFiles = collectSourceFiles(section.map, originalFolderPath);
        originalFiles = new Map([...originalFiles, ...newOriginalFiles]);
      }
    } else
      originalFiles = collectSourceFiles(sourceMap, originalFolderPath);

    try {
      await SourceMapConsumer.with(sourceMap, null, (consumer) => {
        consumer.eachMapping((mapping) => {
          // Is this a valid situation following the spec?
          if (mapping.source === null || mapping.source === "null") return
          const originalFile = originalFiles.get(mapping.source);

          if (originalFile === undefined) {
            errors.push(new Error(`There is no content for file with the path "${mapping.source}" on a disk or in the\`sourcesContent\` section`))
            return
          }

          const notReasonableMappingMessage = this.formatWeirdMappingMessage(mapping, originalFile, generatedFile)

          if (!originalFile.isMappingReasonable(mapping.originalLine, mapping.originalColumn)) {
              errors.push(new Error(`${notReasonableMappingMessage} from the original file perspective`))
          }
          if (!generatedFile.isMappingReasonable(mapping.generatedLine, mapping.generatedColumn)) {
            errors.push(new Error(`${notReasonableMappingMessage} from the generated file perspective`))
          }
        });
      });
    } catch (exn : any) {
      errors.push(new Error(exn.message));
    }

    return ValidationResult.from(errors);
  }

  private formatWeirdMappingMessage(mapping: MappingItem, originalFile: TestingFile, generatedFile: TestingFile): string {
    return `Mapping from "${originalFile.path} (${mapping.originalLine}:${mapping.originalColumn})" to "${generatedFile.path} (${mapping.generatedLine}:${mapping.generatedColumn})" looks not reasonable`
  }
}
