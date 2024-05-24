import path from "path";
import { TestingFile } from "./TestingFile.js";
import type { SourceMap } from "./sourceMap.js";

export function collectSourceFiles(sourceMap: SourceMap, originalFolderPath: string) {
  const filesMap = new Map<string, TestingFile>();

  sourceMap.sources.forEach((file: string | null, index: number) => {
    // When the source is null, it might make sense to map to an anonymous source
    // if a sourceContent is present, but for now just don't add it to the set.
    if (file !== null)
      filesMap.set(file, TestingFile.forTextFile(path.join(originalFolderPath, file), sourceMap.sourcesContent ? sourceMap.sourcesContent[index] : null))
  });

  return filesMap;
}
