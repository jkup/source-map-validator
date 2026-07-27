import { parsedObject } from '../../types.js';
import type { Rule, RuleContext, Diagnostic } from '../../types.js';

/**
 * VLQ validity is primarily checked during decoding (decoder.ts).
 * This rule verifies the raw mappings string for characters that are
 * not part of the VLQ grammar before decoding.
 */

const VALID_MAPPING_CHARS = /^[A-Za-z0-9+/,;]*$/;

export const vlqValidRule: Rule = {
  id: 'vlq-valid',
  description: 'The `mappings` string must contain only valid Base64 VLQ characters',
  severity: 'error',
  level: 1,

  check(context: RuleContext): Diagnostic[] {
    const parsed = parsedObject(context);
    if (!parsed) return [];

    if (typeof parsed.mappings !== 'string') return [];

    const mappings = parsed.mappings;
    if (mappings.length === 0) return [];

    if (!VALID_MAPPING_CHARS.test(mappings)) {
      // Find the first invalid character for a precise error
      for (let i = 0; i < mappings.length; i++) {
        const char = mappings[i]!;
        if (!/[A-Za-z0-9+/,;]/.test(char)) {
          return [
            {
              rule: this.id,
              severity: 'error',
              message: `Invalid character '${char}' (U+${char.charCodeAt(0).toString(16).padStart(4, '0')}) in \`mappings\` at position ${i}`,
            },
          ];
        }
      }
    }

    return [];
  },
};
