import path from "path";
import { TestingFile } from "./TestingFile.js";
import type { SourceMap } from "./sourceMap.js";

export function parseSourceFiles(sourceMap: SourceMap, originalFolderPath: string) {
  const filesMap = new Map<string, TestingFile>();

  sourceMap.sources.forEach((file: string, index: number) => {
    filesMap.set(file, TestingFile.forTextFile(path.join(originalFolderPath, file), sourceMap.sourcesContent[index]))
  });

  return filesMap;
}
