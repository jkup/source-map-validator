import { describe, it, expect } from 'vitest';
import type { ValidationResult } from 'source-map-validator';
import { formatPretty } from '../formatters/pretty.js';
import { formatJson } from '../formatters/json.js';
import { formatGitHub } from '../formatters/github.js';

function makeResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    valid: true,
    diagnostics: [],
    errors: [],
    warnings: [],
    infos: [],
    stats: {
      mappingCount: 10,
      sourceCount: 2,
      nameCount: 3,
      hasSourcesContent: true,
      hasIgnoreList: false,
      hasScopes: false,
      isIndexMap: false,
      extensions: [],
    },
    ...overrides,
  };
}

describe('formatPretty', () => {
  it('shows valid header for passing result', () => {
    const output = formatPretty(makeResult(), 'test.js.map');
    expect(output).toContain('✓ test.js.map');
    expect(output).toContain('source map is valid');
  });

  it('shows error header for failing result', () => {
    const output = formatPretty(
      makeResult({
        valid: false,
        errors: [{ rule: 'valid-json', severity: 'error', message: 'Invalid JSON' }],
        diagnostics: [{ rule: 'valid-json', severity: 'error', message: 'Invalid JSON' }],
      }),
      'bad.js.map',
    );
    expect(output).toContain('✖ bad.js.map');
    expect(output).toContain('source map has errors');
  });

  it('includes stats', () => {
    const output = formatPretty(makeResult(), 'test.js.map');
    expect(output).toContain('10 mappings');
    expect(output).toContain('2 sources');
    expect(output).toContain('3 names');
  });

  it('lists features', () => {
    const output = formatPretty(
      makeResult({
        stats: {
          mappingCount: 1,
          sourceCount: 1,
          nameCount: 0,
          hasSourcesContent: true,
          hasIgnoreList: true,
          hasScopes: false,
          isIndexMap: false,
          extensions: ['x_custom'],
        },
      }),
      'test.js.map',
    );
    expect(output).toContain('sourcesContent');
    expect(output).toContain('ignoreList');
    expect(output).toContain('x_custom');
  });

  it('shows coverage when present', () => {
    const output = formatPretty(
      makeResult({
        coverage: {
          totalCharacters: 100,
          mappedCharacters: 85,
          coveragePercent: 85,
          perLine: [],
          unmappedRanges: [],
        },
      }),
      'test.js.map',
    );
    expect(output).toContain('85%');
    expect(output).toContain('85/100');
  });

  it('groups diagnostics by severity', () => {
    const output = formatPretty(
      makeResult({
        valid: false,
        errors: [{ rule: 'r1', severity: 'error', message: 'error msg' }],
        warnings: [{ rule: 'r2', severity: 'warning', message: 'warn msg' }],
        infos: [{ rule: 'r3', severity: 'info', message: 'info msg' }],
        diagnostics: [
          { rule: 'r1', severity: 'error', message: 'error msg' },
          { rule: 'r2', severity: 'warning', message: 'warn msg' },
          { rule: 'r3', severity: 'info', message: 'info msg' },
        ],
      }),
      'test.js.map',
    );
    expect(output).toContain('Errors (1)');
    expect(output).toContain('Warnings (1)');
    expect(output).toContain('Info (1)');
    expect(output).toContain('error msg');
    expect(output).toContain('warn msg');
    expect(output).toContain('info msg');
  });

  it('shows "No issues found" when clean', () => {
    const output = formatPretty(makeResult(), 'test.js.map');
    expect(output).toContain('No issues found');
  });

  it('formats diagnostic locations', () => {
    const output = formatPretty(
      makeResult({
        valid: false,
        errors: [
          {
            rule: 'r1',
            severity: 'error',
            message: 'bad mapping',
            location: { generatedLine: 5, generatedColumn: 10 },
          },
        ],
        diagnostics: [
          {
            rule: 'r1',
            severity: 'error',
            message: 'bad mapping',
            location: { generatedLine: 5, generatedColumn: 10 },
          },
        ],
      }),
      'test.js.map',
    );
    expect(output).toContain('gen 5:10');
  });
});

describe('formatJson', () => {
  it('returns valid JSON', () => {
    const output = formatJson(makeResult());
    const parsed = JSON.parse(output);
    expect(parsed.valid).toBe(true);
  });

  it('includes all expected fields', () => {
    const output = formatJson(makeResult());
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('valid');
    expect(parsed).toHaveProperty('stats');
    expect(parsed).toHaveProperty('coverage');
    expect(parsed).toHaveProperty('errors');
    expect(parsed).toHaveProperty('warnings');
    expect(parsed).toHaveProperty('infos');
  });

  it('sets coverage to null when absent', () => {
    const output = formatJson(makeResult());
    const parsed = JSON.parse(output);
    expect(parsed.coverage).toBeNull();
  });

  it('includes coverage when present', () => {
    const output = formatJson(
      makeResult({
        coverage: {
          totalCharacters: 50,
          mappedCharacters: 40,
          coveragePercent: 80,
          perLine: [],
          unmappedRanges: [],
        },
      }),
    );
    const parsed = JSON.parse(output);
    expect(parsed.coverage.coveragePercent).toBe(80);
  });

  it('includes diagnostics', () => {
    const output = formatJson(
      makeResult({
        valid: false,
        errors: [{ rule: 'test-rule', severity: 'error', message: 'fail' }],
      }),
    );
    const parsed = JSON.parse(output);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].rule).toBe('test-rule');
  });
});

describe('formatGitHub', () => {
  it('formats errors as ::error workflow commands', () => {
    const output = formatGitHub(
      makeResult({
        diagnostics: [{ rule: 'valid-json', severity: 'error', message: 'Invalid JSON' }],
      }),
      'dist/app.js.map',
    );
    expect(output).toContain('::error');
    expect(output).toContain('file=dist/app.js.map');
    expect(output).toContain('title=valid-json');
    expect(output).toContain('::Invalid JSON');
  });

  it('formats warnings as ::warning', () => {
    const output = formatGitHub(
      makeResult({
        diagnostics: [{ rule: 'r1', severity: 'warning', message: 'warn' }],
      }),
      'test.js.map',
    );
    expect(output).toContain('::warning');
  });

  it('formats info as ::notice', () => {
    const output = formatGitHub(
      makeResult({
        diagnostics: [{ rule: 'r1', severity: 'info', message: 'note' }],
      }),
      'test.js.map',
    );
    expect(output).toContain('::notice');
  });

  it('includes line and column when present', () => {
    const output = formatGitHub(
      makeResult({
        diagnostics: [
          {
            rule: 'r1',
            severity: 'error',
            message: 'bad',
            location: { generatedLine: 3, generatedColumn: 7 },
          },
        ],
      }),
      'test.js.map',
    );
    expect(output).toContain('line=3');
    expect(output).toContain('col=7');
  });

  it('returns empty string when no diagnostics', () => {
    const output = formatGitHub(makeResult(), 'test.js.map');
    expect(output).toBe('');
  });
});
