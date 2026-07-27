/**
 * Count the number of UTF-16 code units in a string.
 * In JavaScript, string.length already returns UTF-16 code unit count,
 * so this is a direct passthrough. This module exists to make the
 * intent explicit and to provide column-counting utilities.
 */

/**
 * Get the UTF-16 code unit length of a string.
 * JavaScript strings are internally UTF-16, so `str.length` is already
 * the count of UTF-16 code units. Characters outside the BMP (e.g., emoji)
 * are represented as surrogate pairs and count as 2 units.
 */
export function utf16Length(str: string): number {
  return str.length;
}

/**
 * Split source content into lines, preserving the line ending style.
 * Returns an array of line contents (without the line terminator).
 */
export function splitLines(content: string): string[] {
  return content.split(/\r\n|\r|\n/);
}

/**
 * Get the UTF-16 code unit length of a specific line in the content.
 * Line number is 0-based.
 */
export function lineUtf16Length(content: string, line: number): number | null {
  const lines = splitLines(content);
  const l = lines[line];
  if (line < 0 || l === undefined) return null;
  return utf16Length(l);
}

/**
 * Get the number of lines in the content.
 */
export function lineCount(content: string): number {
  return splitLines(content).length;
}

/**
 * Extract a token (identifier-like string) starting at a given 0-based
 * UTF-16 column position in a line.
 * Returns the matched word or null if no word character starts at that position.
 */
export function extractTokenAt(line: string, column: number): string | null {
  if (column < 0 || column >= line.length) return null;

  // Check if we're at a word character
  const rest = line.slice(column);
  const match = rest.match(/^[\w$]+/);
  return match ? match[0] : null;
}

/**
 * Build a map of source index → split lines for each source that has content.
 * Checks `sourcesContent` first, then falls back to `originalSources`.
 */
export function buildSourceLines(
  sources: (string | null)[],
  sourcesContent: (string | null)[] | undefined,
  originalSources: Record<string, string> | undefined,
): Map<number, string[]> {
  const sourceLines = new Map<number, string[]>();
  for (let i = 0; i < sources.length; i++) {
    const sourcePath = sources[i];
    let content: string | null = null;
    if (sourcesContent?.[i]) {
      content = sourcesContent[i]!;
    } else if (sourcePath && originalSources?.[sourcePath]) {
      content = originalSources[sourcePath]!;
    }
    if (content !== null) {
      sourceLines.set(i, splitLines(content));
    }
  }
  return sourceLines;
}
