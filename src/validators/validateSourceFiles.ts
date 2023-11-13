import fs from "fs";
import path from "path";
import { type SourceMap } from "../util/sourceMap";

export function validateSourceFiles(
  sourceMap: SourceMap,
  originalFolderPath: string
) {
  sourceMap.sources.forEach((sourceFileName: string) => {
    const fullPath = path.join(originalFolderPath, sourceFileName);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Source file not found: ${sourceFileName}`);
    }
  });
}
