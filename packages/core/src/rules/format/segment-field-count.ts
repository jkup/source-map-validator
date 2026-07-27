import type { Rule, Diagnostic } from '../../types.js';

/**
 * Each VLQ segment must have exactly 1, 4, or 5 fields.
 *
 * This check is performed during decoding (decoder.ts) because the segment
 * structure is only available while parsing the raw mappings string.
 * The decoder emits diagnostics with this rule's ID directly.
 *
 * This rule exists so that `segment-field-count` is registered, discoverable
 * via `allRules`, and can be toggled with `--disable`.
 */
export const segmentFieldCountRule: Rule = {
  id: 'segment-field-count',
  description: 'Each VLQ segment must have exactly 1, 4, or 5 fields',
  severity: 'error',
  level: 1,

  check(): Diagnostic[] {
    // Diagnostics are emitted by the decoder during mappings decode.
    return [];
  },
};
