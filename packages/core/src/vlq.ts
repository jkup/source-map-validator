// Base64 character → 6-bit value lookup.
// A-Z = 0-25, a-z = 26-51, 0-9 = 52-61, + = 62, / = 63
export const BASE64: Record<string, number> = {};
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
for (let i = 0; i < CHARS.length; i++) {
  const ch = CHARS[i];
  if (ch !== undefined) BASE64[ch] = i;
}

export const VLQ_CONTINUATION_BIT = 0b100000; // 6th bit
export const VLQ_VALUE_MASK = 0b011111; // lower 5 bits
export const MAX_INT32 = 2 ** 31;

export type VlqResult = { value: number; nextIndex: number } | { error: string; nextIndex: number };

/**
 * Decode a single signed VLQ value starting at `index`.
 * Returns the decoded signed integer and the new index, or an error.
 */
export function decodeVlqSigned(input: string, index: number): VlqResult {
  let result = 0;
  let shift = 0;
  let continuation = true;

  while (continuation) {
    if (index >= input.length) {
      return { error: 'Unterminated VLQ sequence', nextIndex: index };
    }

    const char = input[index]!;
    const digit = BASE64[char];
    if (digit === undefined) {
      return {
        error: `Invalid Base64 character '${char}' at position ${index}`,
        nextIndex: index,
      };
    }

    continuation = (digit & VLQ_CONTINUATION_BIT) !== 0;
    result += (digit & VLQ_VALUE_MASK) * 2 ** shift;
    shift += 5;
    index++;
  }

  // Check the unsigned result fits in 33 bits (32 value bits + 1 sign bit)
  if (result >= 2 ** 33) {
    return { error: 'VLQ value exceeds 32-bit limit', nextIndex: index };
  }

  // Convert to signed: LSB is the sign bit
  const isNegative = (result & 1) === 1;
  const unsigned = Math.floor(result / 2);

  if (unsigned >= MAX_INT32 && !(isNegative && unsigned === MAX_INT32)) {
    return { error: 'VLQ value exceeds 32-bit limit', nextIndex: index };
  }

  const value = isNegative ? (unsigned === MAX_INT32 ? -MAX_INT32 : -unsigned) : unsigned;
  return { value, nextIndex: index };
}

/**
 * Decode a single unsigned VLQ value starting at `index`.
 * Same encoding as signed but the LSB is NOT a sign bit.
 */
export function decodeVlqUnsigned(input: string, index: number): VlqResult {
  let result = 0;
  let shift = 0;
  let continuation = true;

  while (continuation) {
    if (index >= input.length) {
      return { error: 'Unterminated VLQ sequence', nextIndex: index };
    }

    const char = input[index]!;
    const digit = BASE64[char];
    if (digit === undefined) {
      return {
        error: `Invalid Base64 character '${char}' at position ${index}`,
        nextIndex: index,
      };
    }

    continuation = (digit & VLQ_CONTINUATION_BIT) !== 0;
    result += (digit & VLQ_VALUE_MASK) * 2 ** shift;
    shift += 5;
    index++;
  }

  if (result >= 2 ** 32) {
    return { error: 'VLQ value exceeds 32-bit limit', nextIndex: index };
  }

  return { value: result, nextIndex: index };
}

/**
 * Skip VLQ values until the next comma or end of string.
 * Used for error recovery when encountering unknown tags.
 */
export function skipToNextItem(input: string, index: number): number {
  while (index < input.length && input[index] !== ',') {
    index++;
  }
  return index;
}
