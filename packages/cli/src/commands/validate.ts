import fs from 'node:fs';
import path from 'node:path';
import { validate, allRules, allProposals } from 'source-map-validator';
import type { ValidateOptions } from 'source-map-validator';
import { formatPretty } from '../formatters/pretty.js';
import { formatJson } from '../formatters/json.js';
import { formatGitHub } from '../formatters/github.js';

interface ValidateCommandOptions {
  generated?: string;
  sourcesDir?: string;
  format: string;
  disable?: string;
  only?: string;
  preset?: string;
  proposals?: string;
}

const VALID_FORMATS = ['pretty', 'json', 'github'] as const;
const VALID_PRESETS = ['strict', 'ci', 'minimal'] as const;

export function runValidate(files: string[], options: ValidateCommandOptions): number {
  // Validate --format
  if (!VALID_FORMATS.includes(options.format as (typeof VALID_FORMATS)[number])) {
    console.error(`Invalid format "${options.format}". Valid formats: ${VALID_FORMATS.join(', ')}`);
    return 1;
  }

  // Validate --preset
  if (
    options.preset !== undefined &&
    !VALID_PRESETS.includes(options.preset as (typeof VALID_PRESETS)[number])
  ) {
    console.error(`Invalid preset "${options.preset}". Valid presets: ${VALID_PRESETS.join(', ')}`);
    return 1;
  }

  // Validate --proposals
  let proposals: string[] | undefined;
  if (options.proposals) {
    const requested = options.proposals.split(',').map((p) => p.trim());
    if (requested.includes('all')) {
      proposals = [...allProposals];
    } else {
      const unknown = requested.filter((p) => !allProposals.has(p));
      if (unknown.length > 0) {
        console.error(
          `Unknown proposal(s): ${unknown.join(', ')}. Valid proposals: ${[...allProposals].join(', ')}`,
        );
        return 1;
      }
      proposals = requested;
    }
  }

  // Validate rule IDs in --disable and --only
  const knownRuleIds = new Set(allRules.map((r) => r.id));

  for (const flag of ['disable', 'only'] as const) {
    const value = options[flag];
    if (!value) continue;

    const ids = value.split(',').map((id) => id.trim());
    const unknown = ids.filter((id) => !knownRuleIds.has(id));
    if (unknown.length > 0) {
      console.error(
        `Unknown rule ID(s) in --${flag}: ${unknown.join(', ')}. ` +
          `Valid rules: ${[...knownRuleIds].join(', ')}`,
      );
      return 1;
    }
  }

  let hasErrors = false;

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      hasErrors = true;
      continue;
    }

    let sourceMap: string;
    try {
      sourceMap = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.error(`Cannot read file: ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
      hasErrors = true;
      continue;
    }

    const validateOptions: ValidateOptions = {
      sourceMap,
      preset: options.preset as ValidateOptions['preset'],
      proposals,
    };

    // Load generated file if specified
    if (options.generated) {
      if (!fs.existsSync(options.generated)) {
        console.error(`Generated file not found: ${options.generated}`);
        hasErrors = true;
        continue;
      }
      const isWasm = options.generated.endsWith('.wasm');
      try {
        validateOptions.generatedSource = fs.readFileSync(
          options.generated,
          isWasm ? 'latin1' : 'utf-8',
        );
        if (isWasm) {
          validateOptions.generatedFileType = 'wasm';
        }
      } catch (e) {
        console.error(
          `Cannot read generated file: ${options.generated}: ${e instanceof Error ? e.message : String(e)}`,
        );
        hasErrors = true;
        continue;
      }
    }

    // Load original sources if directory specified
    if (options.sourcesDir) {
      validateOptions.originalSources = loadSourcesFromDir(options.sourcesDir);
    }

    // Rule overrides
    if (options.disable) {
      const rules: Record<string, boolean> = {};
      for (const id of options.disable.split(',')) {
        rules[id.trim()] = false;
      }
      validateOptions.rules = { ...validateOptions.rules, ...rules };
    }

    if (options.only) {
      // In "only" mode, first disable all rules, then enable selected ones
      const rules: Record<string, boolean> = {};
      for (const rule of allRules) {
        rules[rule.id] = false;
      }
      for (const id of options.only.split(',')) {
        rules[id.trim()] = true;
      }
      validateOptions.rules = { ...validateOptions.rules, ...rules };
    }

    const result = validate(validateOptions);

    switch (options.format) {
      case 'json':
        console.log(formatJson(result));
        break;
      case 'github':
        console.log(formatGitHub(result, filePath));
        break;
      default:
        console.log(formatPretty(result, filePath));
    }

    if (!result.valid) {
      hasErrors = true;
    }
  }

  return hasErrors ? 1 : 0;
}

function loadSourcesFromDir(dir: string): Record<string, string> {
  const sources: Record<string, string> = {};

  function walk(currentDir: string, prefix: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Skip node_modules and hidden dirs
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(fullPath, relativePath);
      } else if (entry.isFile()) {
        try {
          sources[relativePath] = fs.readFileSync(fullPath, 'utf-8');
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          console.error(`Warning: could not read ${fullPath}: ${detail}`);
        }
      }
    }
  }

  if (fs.existsSync(dir)) {
    walk(dir, '');
  }

  return sources;
}
