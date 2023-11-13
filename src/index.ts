#!/usr/bin/env node

import yargs from "yargs";
import path from "path";

import { validateSourceMapJSON } from "./validators/validateSourceMapJSON";
import { validateSourceMapFormat } from "./validators/validateSourceMapFormat";
import { validateSourceFiles } from "./validators/validateSourceFiles";
import { validateSourceMapMappings } from "./validators/validateSourceMapMappings";

type ValidatorResult = {
  result: boolean;
  message: string;
};

async function validateSourceMap(): Promise<ValidatorResult> {
  const parser = yargs(process.argv.slice(2))
    .usage("Usage: -s <source map> -g <generated file> -o <original file>")
    .options({
      s: {
        alias: "sourceMap",
        describe: "Source map file path",
        type: "string",
        demandOption: true,
      },
      g: {
        alias: "generatedFile",
        describe: "Generated file path",
        type: "string",
        demandOption: true,
      },
      o: {
        alias: "originalFolder",
        describe: "Original folder path",
        type: "string",
        demandOption: true,
      },
    });

  const argv = await parser.argv;

  const sourceMapPath = path.resolve(argv.s);
  const originalFolderPath = path.resolve(argv.o);
  const generatedFilePath = path.resolve(argv.g);

  const sourceMap = validateSourceMapJSON(sourceMapPath);

  try {
    validateSourceMapFormat(sourceMap, sourceMapPath);
    validateSourceFiles(sourceMap, originalFolderPath);
    validateSourceMapMappings(sourceMap, originalFolderPath, generatedFilePath);
  } catch (e: any) {
    console.error(e.message);
    return {
      result: false,
      message: e.message,
    };
  }

  console.log("Source map is valid.");
  return {
    result: true,
    message: "Source map is valid.",
  };
}

validateSourceMap();
