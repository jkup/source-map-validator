import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { runInspect } from '../commands/inspect.js';

const FIXTURES = path.resolve(__dirname, '../../../../test-fixtures');
const VALID_MAP = path.join(FIXTURES, 'simple.js.map');

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('runInspect', () => {
  it('returns 0 for a valid source map', () => {
    const code = runInspect(VALID_MAP);
    expect(code).toBe(0);
  });

  it('returns 1 for a missing file', () => {
    const code = runInspect('/nonexistent/file.map');
    expect(code).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('File not found'));
  });

  it('outputs stats for the source map', () => {
    runInspect(VALID_MAP);
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Mappings:');
    expect(output).toContain('Sources:');
    expect(output).toContain('Names:');
  });

  it('lists source files', () => {
    runInspect(VALID_MAP);
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('app.ts');
  });

  it('shows first decoded mappings', () => {
    runInspect(VALID_MAP);
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('First 10 mappings');
    expect(output).toContain('gen 1:');
  });
});
