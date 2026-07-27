import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { runCoverage } from '../commands/coverage.js';

const FIXTURES = path.resolve(__dirname, '../../../../test-fixtures');
const VALID_MAP = path.join(FIXTURES, 'simple.js.map');
const VALID_JS = path.join(FIXTURES, 'simple.js');

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('runCoverage', () => {
  it('returns 0 and shows coverage for valid inputs', () => {
    const code = runCoverage(VALID_MAP, VALID_JS);
    expect(code).toBe(0);
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Coverage Report');
    expect(output).toContain('%');
  });

  it('returns 1 when source map file is missing', () => {
    const code = runCoverage('/nonexistent/file.map', VALID_JS);
    expect(code).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Source map not found'));
  });

  it('returns 1 when generated file is missing', () => {
    const code = runCoverage(VALID_MAP, '/nonexistent/file.js');
    expect(code).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Generated file not found'));
  });

  it('shows overall percentage in output', () => {
    runCoverage(VALID_MAP, VALID_JS);
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join('\n');
    // Should show "Overall: XX%"
    expect(output).toMatch(/Overall:.*\d+(\.\d+)?%/);
  });
});
