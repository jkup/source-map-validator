import fs from "fs";
import path from "path";
import { TestingFile } from "./TestingFile.js";

export function parseSourceFiles(originalFolderPath: string) {
  const filesASTMap = new Map<string, TestingFile>();

  // Read all files in the folder
  const files = fs.readdirSync(originalFolderPath);
  files.forEach((file) => {
    if (path.extname(file) === ".js") {
      filesASTMap.set(file, TestingFile.fromPath(path.join(originalFolderPath, file)));
    }
  });

  return filesASTMap;
}
