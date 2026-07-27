import type { ValidationResult } from 'source-map-validator';

/**
 * Format diagnostics as GitHub Actions workflow commands.
 * These produce inline annotations in PRs.
 * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 */
export function formatGitHub(result: ValidationResult, filePath: string): string {
  const lines: string[] = [];

  for (const d of result.diagnostics) {
    const level =
      d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'notice';

    const params: string[] = [`file=${filePath}`];
    if (d.location?.generatedLine !== undefined) {
      params.push(`line=${d.location.generatedLine}`);
    }
    if (d.location?.generatedColumn !== undefined) {
      params.push(`col=${d.location.generatedColumn}`);
    }
    params.push(`title=${d.rule}`);

    lines.push(`::${level} ${params.join(',')}::${d.message}`);
  }

  return lines.join('\n');
}
