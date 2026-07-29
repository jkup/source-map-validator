import fs from 'node:fs';
import { validate } from 'source-map-validator';
import { RED, YELLOW, GREEN, DIM, BOLD, RESET } from '../colors.js';

export function runCoverage(mapPath: string, generatedPath: string): number {
  if (!fs.existsSync(mapPath)) {
    console.error(`Source map not found: ${mapPath}`);
    return 1;
  }
  if (!fs.existsSync(generatedPath)) {
    console.error(`Generated file not found: ${generatedPath}`);
    return 1;
  }

  let sourceMap: string;
  let generatedSource: string;
  try {
    sourceMap = fs.readFileSync(mapPath, 'utf-8');
  } catch (e) {
    console.error(`Cannot read file: ${mapPath}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  const isWasm = generatedPath.endsWith('.wasm');
  try {
    generatedSource = fs.readFileSync(generatedPath, isWasm ? 'latin1' : 'utf-8');
  } catch (e) {
    console.error(
      `Cannot read file: ${generatedPath}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return 1;
  }

  const result = validate({
    sourceMap,
    generatedSource,
    generatedFileType: isWasm ? 'wasm' : undefined,
  });

  if (!result.coverage) {
    console.error('Could not compute coverage — source map may be invalid');
    return 1;
  }

  const c = result.coverage;
  const pctColor = c.coveragePercent > 80 ? GREEN : c.coveragePercent > 50 ? YELLOW : RED;

  console.log('');
  console.log(`${BOLD}Source Map Coverage Report${RESET}`);
  console.log('');
  console.log(
    `  Overall: ${pctColor}${BOLD}${c.coveragePercent}%${RESET} (${c.mappedCharacters}/${c.totalCharacters} characters)`,
  );
  console.log('');

  // Per-line coverage summary (show lines with low coverage)
  const lowCoverageLines = c.perLine.filter((l) => l.coverage < 0.5 && l.coverage >= 0);
  if (lowCoverageLines.length > 0) {
    console.log(`  ${YELLOW}Lines with < 50% coverage:${RESET}`);
    const toShow = lowCoverageLines.slice(0, 30);
    for (const l of toShow) {
      const pct = Math.round(l.coverage * 100);
      const bar = makeBar(l.coverage);
      console.log(`    Line ${String(l.line).padStart(5)}: ${bar} ${pct}%`);
    }
    if (lowCoverageLines.length > 30) {
      console.log(`    ${DIM}...and ${lowCoverageLines.length - 30} more${RESET}`);
    }
    console.log('');
  }

  // Unmapped ranges
  if (c.unmappedRanges.length > 0) {
    console.log(`  ${RED}Unmapped regions: ${c.unmappedRanges.length}${RESET}`);
    const toShow = c.unmappedRanges.slice(0, 20);
    for (const r of toShow) {
      console.log(`    Line ${r.line}, cols ${r.startCol}-${r.endCol}`);
    }
    if (c.unmappedRanges.length > 20) {
      console.log(`    ${DIM}...and ${c.unmappedRanges.length - 20} more${RESET}`);
    }
    console.log('');
  }

  return 0;
}

function makeBar(coverage: number): string {
  const width = 20;
  const filled = Math.round(coverage * width);
  const empty = width - filled;
  const color = coverage > 0.8 ? GREEN : coverage > 0.5 ? YELLOW : RED;
  return `${color}${'█'.repeat(filled)}${'░'.repeat(empty)}${RESET}`;
}
