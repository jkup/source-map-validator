import type { ValidationResult } from 'source-map-validator';

export function formatJson(result: ValidationResult): string {
  return JSON.stringify(
    {
      valid: result.valid,
      stats: result.stats,
      coverage: result.coverage ?? null,
      errors: result.errors,
      warnings: result.warnings,
      infos: result.infos,
    },
    null,
    2,
  );
}
