#!/usr/bin/env node

import { Command } from 'commander';
import { runValidate } from './commands/validate.js';
import { runInspect } from './commands/inspect.js';
import { runCoverage } from './commands/coverage.js';

const program = new Command();

program
  .name('sourcemap-validator')
  .description('Validate source maps against ECMA-426')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate one or more source map files')
  .argument('<files...>', 'Source map file(s) to validate')
  .option('--generated <file>', 'Generated JS/CSS file (enables Level 2 checks)')
  .option('--sources-dir <dir>', 'Directory containing original sources (enables Level 3 checks)')
  .option('--format <format>', 'Output format: pretty, json, github', 'pretty')
  .option('--disable <rules>', 'Comma-separated list of rule IDs to disable')
  .option('--only <rules>', 'Comma-separated list of rule IDs to enable (disables all others)')
  .option('--preset <preset>', 'Validation preset: strict, ci, minimal')
  .option('--proposals <proposals>', 'Enable proposal rules (comma-separated, e.g. scopes)')
  .action((files: string[], options) => {
    const exitCode = runValidate(files, options);
    process.exit(exitCode);
  });

program
  .command('inspect')
  .description('Inspect a source map: show decoded mappings, sources, and stats')
  .argument('<file>', 'Source map file to inspect')
  .action((file: string) => {
    const exitCode = runInspect(file);
    process.exit(exitCode);
  });

program
  .command('coverage')
  .description('Analyze mapping coverage of a generated file')
  .argument('<map>', 'Source map file')
  .argument('<generated>', 'Generated JS/CSS file')
  .action((map: string, generated: string) => {
    const exitCode = runCoverage(map, generated);
    process.exit(exitCode);
  });

program.parse();
