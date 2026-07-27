import type { ValidationResult, Diagnostic } from 'source-map-validator';
import { RED, YELLOW, BLUE, GREEN, DIM, BOLD, RESET } from '../colors.js';

function severityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return `${RED}✖${RESET}`;
    case 'warning':
      return `${YELLOW}⚠${RESET}`;
    case 'info':
      return `${BLUE}ℹ${RESET}`;
    default:
      return ' ';
  }
}

function formatLocation(d: Diagnostic): string {
  if (!d.location) return '';

  const parts: string[] = [];
  if (d.location.generatedLine !== undefined) {
    let loc = `gen ${d.location.generatedLine}`;
    if (d.location.generatedColumn !== undefined) {
      loc += `:${d.location.generatedColumn}`;
    }
    parts.push(loc);
  }
  if (d.location.originalSource) {
    let loc = d.location.originalSource;
    if (d.location.originalLine !== undefined) {
      loc += `:${d.location.originalLine}`;
      if (d.location.originalColumn !== undefined) {
        loc += `:${d.location.originalColumn}`;
      }
    }
    parts.push(loc);
  }

  return parts.length > 0 ? ` ${DIM}(${parts.join(' → ')})${RESET}` : '';
}

export function formatPretty(result: ValidationResult, filePath: string): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  if (result.valid) {
    lines.push(`${GREEN}${BOLD}✓ ${filePath}${RESET} — source map is valid`);
  } else {
    lines.push(`${RED}${BOLD}✖ ${filePath}${RESET} — source map has errors`);
  }
  lines.push('');

  // Stats
  const s = result.stats;
  lines.push(
    `${DIM}  ${s.mappingCount} mappings · ${s.sourceCount} sources · ${s.nameCount} names${RESET}`,
  );
  const features: string[] = [];
  if (s.hasSourcesContent) features.push('sourcesContent');
  if (s.hasIgnoreList) features.push('ignoreList');
  if (s.hasScopes) features.push('scopes (proposal)');
  if (s.isIndexMap) features.push('index map');
  if (s.extensions.length > 0) features.push(`extensions: ${s.extensions.join(', ')}`);
  if (features.length > 0) {
    lines.push(`${DIM}  Features: ${features.join(' · ')}${RESET}`);
  }
  lines.push('');

  // Coverage
  if (result.coverage) {
    const c = result.coverage;
    const pct = c.coveragePercent;
    const color = pct > 80 ? GREEN : pct > 50 ? YELLOW : RED;
    lines.push(
      `  Coverage: ${color}${BOLD}${pct}%${RESET} (${c.mappedCharacters}/${c.totalCharacters} characters)`,
    );
    lines.push('');
  }

  // Diagnostics grouped by severity
  const groups: [string, Diagnostic[]][] = [
    ['Errors', result.errors],
    ['Warnings', result.warnings],
    ['Info', result.infos],
  ];

  for (const [label, diagnostics] of groups) {
    if (diagnostics.length === 0) continue;

    const color = label === 'Errors' ? RED : label === 'Warnings' ? YELLOW : BLUE;
    lines.push(`  ${color}${BOLD}${label} (${diagnostics.length})${RESET}`);
    lines.push('');

    for (const d of diagnostics) {
      const icon = severityIcon(d.severity);
      const loc = formatLocation(d);
      lines.push(`    ${icon} ${d.message}${loc}`);
      lines.push(`      ${DIM}rule: ${d.rule}${RESET}`);
    }
    lines.push('');
  }

  // Summary
  const summary: string[] = [];
  if (result.errors.length > 0) summary.push(`${RED}${result.errors.length} error(s)${RESET}`);
  if (result.warnings.length > 0)
    summary.push(`${YELLOW}${result.warnings.length} warning(s)${RESET}`);
  if (result.infos.length > 0) summary.push(`${BLUE}${result.infos.length} info${RESET}`);
  if (summary.length > 0) {
    lines.push(`  ${summary.join(' · ')}`);
  } else {
    lines.push(`  ${GREEN}No issues found${RESET}`);
  }
  lines.push('');

  return lines.join('\n');
}
