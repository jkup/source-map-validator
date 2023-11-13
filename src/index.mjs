#!/usr/bin/env node

import yargs from "yargs";
import fs from "fs";
import path from "path";

import { validateSourceMapFormat } from "./validateSourceMapFormat.mjs";
import { validateSourceFiles } from "./validateSourceFiles.mjs";

// const options = yargs(process.argv.slice(2))
//   .usage("Usage: -s <source map> -g <generated file> -o <original file>")
//   .option("s", {
//     alias: "sourceMap",
//     describe: "Source map file path",
//     type: "string",
//     demandOption: true,
//   })
//   .option("g", {
//     alias: "generatedFile",
//     describe: "Generated file path",
//     type: "string",
//     demandOption: true,
//   })
//   .option("o", {
//     alias: "originalFile",
//     describe: "Original file path",
//     type: "string",
//     demandOption: true,
//   }).argv;

// Hard code for now
const sourceMapPath = path.resolve("./test/simple/simple.js.map");
const originalFolderPath = path.resolve("./test/simple/original");
const generatedFilePath = path.resolve("./test/simple/simple.generated.js");

const sourceMapContent = fs.readFileSync(sourceMapPath, "utf8");
const sourceMap = JSON.parse(sourceMapContent);

validateSourceMapFormat(sourceMap, sourceMapPath);
validateSourceFiles(sourceMap, originalFolderPath);
