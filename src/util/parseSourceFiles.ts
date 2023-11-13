import fs from "fs";
import path from "path";
import babelParser from "@babel/parser";

export function parseSourceFiles(originalFolderPath: string) {
  const filesASTMap = new Map();

  // Read all files in the folder
  const files = fs.readdirSync(originalFolderPath);
  files.forEach((file) => {
    if (path.extname(file) === ".js") {
      // Ensure it's a JavaScript file
      const filePath = path.join(originalFolderPath, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const ast = babelParser.parse(fileContent, {
        sourceType: "module",
        tokens: true,
      });
      filesASTMap.set(file, ast);
    }
  });

  return filesASTMap;
}
