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

export default async function main(args: string[]): Promise<ValidatorResult> {
  const parser = yargs(args)
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

  try {
    const sourceMap = validateSourceMapJSON(sourceMapPath);

    validateSourceMapFormat(sourceMap, sourceMapPath);
    validateSourceFiles(sourceMap, originalFolderPath);

    await validateSourceMapMappings(
      sourceMap,
      originalFolderPath,
      generatedFilePath
    );

    console.log("Source map is valid.");
    return {
      result: true,
      message: "Source map is valid.",
    };
  } catch (e: any) {
    console.error(e.message);
    return {
      result: false,
      message: e.message,
    };
  }
}

// Check if the script is called from the command line
const currentFileUrl = new URL(import.meta.url).pathname;
const executedFile = process.argv[1];

// On Windows, normalize backslashes to forward slashes
const currentFileNormalized = currentFileUrl.replace(/\\/g, "/");
const executedFileNormalized = executedFile.replace(/\\/g, "/");

if (currentFileNormalized === executedFileNormalized) {
  await main(process.argv.slice(2));
}
