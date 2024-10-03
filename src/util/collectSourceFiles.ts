import path from "path";
import { TestingFile } from "./TestingFile.js";
import type { SourceMap } from "./sourceMap.js";

export function collectSourceFiles(sourceMap: SourceMap, originalFolderPath: string) {
  const filesMap = new Map<string, TestingFile>();
  const sourceRoot = sourceMap.sourceRoot || "";

  sourceMap.sources.forEach((file: string | null, index: number) => {
    // When the source is null, it might make sense to map to an anonymous source
    // if a sourceContent is present, but for now just don't add it to the set.
    if (file !== null)
      filesMap.set(path.join(sourceRoot, file), TestingFile.forTextFile(path.join(originalFolderPath, sourceRoot, file), sourceMap.sourcesContent ? sourceMap.sourcesContent[index] : null))
  });

  return filesMap;
}
