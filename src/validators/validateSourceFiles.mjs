import fs from "fs";
import path from "path";

export function validateSourceFiles(sourceMap, originalFolderPath) {
  try {
    sourceMap.sources.forEach((sourceFileName) => {
      const fullPath = path.join(originalFolderPath, sourceFileName);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Source file not found: ${sourceFileName}`);
      }
    });

    console.log("All source files are present.");
  } catch (err) {
    console.error("Source file validation error: ", err.message);
  }
}
