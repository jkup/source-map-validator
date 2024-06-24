#!/usr/bin/env node

import yargs from "yargs";
import path from "path";

import validations from "./validations.js";
import { ValidationFail } from "./util/ValidationResult.js";
import { ValidationContext } from "./util/ValidationContext.js";

type ValidatorResult =
  | { isValid: true; errors: [] }
  | { isValid: false; errors: Error[] };

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

  const context = ValidationContext.from(
    sourceMapPath,
    originalFolderPath,
    generatedFilePath
  );
  const result = await validations.validate(context);

  return result instanceof ValidationFail
    ? { isValid: false, errors: result.errors }
    : { isValid: true, errors: [] };
}

// Check if the script is called from the command line
const currentFileUrl = new URL(import.meta.url).pathname;
const executedFile = process.argv[1];

// On Windows, normalize backslashes to forward slashes
const currentFileNormalized = currentFileUrl.replace(/\\/g, "/");
const executedFileNormalized = executedFile.replace(/\\/g, "/");

if (currentFileNormalized === executedFileNormalized) {
  const result = await main(process.argv.slice(2));
  if (result.isValid) {
    console.log("Source map is valid.");
    process.exit(0);
  } else {
    console.error(
      `Source map is invalid:\n${result.errors
        .map((x) => x.message)
        .join("\n\n")}`
    );
    process.exit(1);
  }
}
