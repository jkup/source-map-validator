import fs from "fs";

export function validateSourceMapJSON(sourceMapPath) {
  try {
    // Check if file exists and can be read
    fs.accessSync(sourceMapPath, fs.constants.R_OK);

    // Read file contents
    const sourceMapContent = fs.readFileSync(sourceMapPath, "utf8");

    // Parse JSON
    const sourceMapJSON = JSON.parse(sourceMapContent);

    // Return parsed JSON
    return sourceMapJSON;
  } catch (error) {
    return false;
  }
}
