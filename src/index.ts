#!/usr/bin/env node

const yargs = require("yargs");

const options = yargs
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
    alias: "originalFile",
    describe: "Original file path",
    type: "string",
    demandOption: true,
  }).argv;
