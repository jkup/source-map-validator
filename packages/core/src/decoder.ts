import type { DecodedMappings, DecodedSegment, Diagnostic } from './types.js';
import { decodeVlqSigned } from './vlq.js';

export interface DecodeResult {
  mappings: DecodedMappings;
  diagnostics: Diagnostic[];
}

/**
 * Decode the full `mappings` string into absolute-position segments.
 * Collects errors as diagnostics rather than throwing.
 */
export function decodeMappings(mappings: string): DecodeResult {
  const result: DecodedMappings = [];
  const diagnostics: Diagnostic[] = [];

  if (mappings.length === 0) {
    return { mappings: result, diagnostics };
  }

  // Relative state trackers (these carry across lines)
  let relGeneratedColumn = 0;
  let relSourceIndex = 0;
  let relOriginalLine = 0;
  let relOriginalColumn = 0;
  let relNameIndex = 0;

  let generatedLine = 0;
  let index = 0;
  let currentLine: DecodedSegment[] = [];

  while (index < mappings.length) {
    if (mappings[index] === ';') {
      result.push(currentLine);
      currentLine = [];
      generatedLine++;
      relGeneratedColumn = 0; // reset column at each new line
      index++;
      continue;
    }

    if (mappings[index] === ',') {
      // A comma here means either a separator after a segment (fine) or an empty
      // segment (zero fields). We detect zero-field segments by checking if the
      // previous character was also a separator (comma, semicolon, or start of string).
      if (index === 0 || mappings[index - 1] === ',' || mappings[index - 1] === ';') {
        diagnostics.push({
          rule: 'segment-field-count',
          severity: 'error',
          message: `Segment has 0 fields (expected 1, 4, or 5) at line ${generatedLine + 1}, position ${index}`,
          location: { generatedLine: generatedLine + 1 },
        });
      }
      index++;
      continue;
    }

    // Decode segment fields
    const fields: number[] = [];
    const segmentStart = index;

    while (index < mappings.length && mappings[index] !== ',' && mappings[index] !== ';') {
      const decoded = decodeVlqSigned(mappings, index);
      if ('error' in decoded) {
        diagnostics.push({
          rule: 'vlq-valid',
          severity: 'error',
          message: decoded.error,
          location: { generatedLine: generatedLine + 1 },
        });
        // Skip to next separator
        while (index < mappings.length && mappings[index] !== ',' && mappings[index] !== ';') {
          index++;
        }
        break;
      }
      fields.push(decoded.value);
      index = decoded.nextIndex;
    }

    if (fields.length === 0) {
      diagnostics.push({
        rule: 'segment-field-count',
        severity: 'error',
        message: `Segment has 0 fields (expected 1, 4, or 5) at line ${generatedLine + 1}, position ${segmentStart}`,
        location: { generatedLine: generatedLine + 1 },
      });
      continue;
    }

    // Validate field count
    if (fields.length !== 1 && fields.length !== 4 && fields.length !== 5) {
      diagnostics.push({
        rule: 'segment-field-count',
        severity: 'error',
        message: `Segment has ${fields.length} fields (expected 1, 4, or 5) at line ${generatedLine + 1}, position ${segmentStart}`,
        location: { generatedLine: generatedLine + 1 },
      });
      continue;
    }

    // Field 1: generated column (relative within line)
    relGeneratedColumn += fields[0]!;

    const segment: DecodedSegment = {
      generatedColumn: relGeneratedColumn,
    };

    if (fields.length >= 4) {
      // Field 2: source index (relative)
      relSourceIndex += fields[1]!;
      segment.sourceIndex = relSourceIndex;

      // Field 3: original line (relative)
      relOriginalLine += fields[2]!;
      segment.originalLine = relOriginalLine;

      // Field 4: original column (relative)
      relOriginalColumn += fields[3]!;
      segment.originalColumn = relOriginalColumn;
    }

    if (fields.length === 5) {
      // Field 5: name index (relative)
      relNameIndex += fields[4]!;
      segment.nameIndex = relNameIndex;
    }

    currentLine.push(segment);
  }

  // Flush the final line (mappings don't end with ';')
  result.push(currentLine);

  return { mappings: result, diagnostics };
}
