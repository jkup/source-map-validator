#!/usr/bin/env node

import yargs from "yargs";
import fs from "fs";
import path from "path";

import { validateSourceMapFormat } from "./validators/validateSourceMapFormat.mjs";
import { validateSourceFiles } from "./validators/validateSourceFiles.mjs";
import { validateSourceMapMappings } from "./validators/validateSourceMapMappings.mjs";

const options = yargs(process.argv.slice(2))
  .usage("Usage: -s <source map> -g <generated file> -o <original file>")
  .option("s", {
    alias: "sourceMap",
    describe: "Source map file path",
    type: "string",
    demandOption: true,
  })
  .option("g", {
    alias: "generatedFile",
    describe: "Generated file path",
    type: "string",
    demandOption: true,
  })
  .option("o", {
    alias: "originalFolder",
    describe: "Original folder path",
    type: "string",
    demandOption: true,
  }).argv;

const sourceMapPath = path.resolve(options.sourceMap);
const originalFolderPath = path.resolve(options.originalFolder);
const generatedFilePath = path.resolve(options.generatedFile);

const sourceMapContent = fs.readFileSync(sourceMapPath, "utf8");
const sourceMap = JSON.parse(sourceMapContent);

validateSourceMapFormat(sourceMap, sourceMapPath);
validateSourceFiles(sourceMap, originalFolderPath);
validateSourceMapMappings(sourceMap, originalFolderPath, generatedFilePath);
