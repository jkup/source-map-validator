import type {
  DecodedMappings,
  CoverageReport,
  UnmappedRange,
  CoverageLineReport,
} from './types.js';
import { splitLines, utf16Length } from './utf16.js';

/**
 * Analyze mapping coverage: what percentage of the generated file's characters
 * are covered by at least one mapping segment.
 *
 * A character is "covered" if there exists a mapping segment on that line whose
 * generated column is at or before that character position. Coverage extends from
 * a segment's column to the next segment's column (or end of line).
 */
export function analyzeCoverage(
  mappings: DecodedMappings,
  generatedSource: string,
  generatedFileType?: 'text' | 'wasm',
): CoverageReport {
  if (generatedFileType === 'wasm') {
    return analyzeWasmCoverage(mappings, generatedSource);
  }

  const lines = splitLines(generatedSource);
  let totalCharacters = 0;
  let mappedCharacters = 0;
  const perLine: CoverageLineReport[] = [];
  const unmappedRanges: UnmappedRange[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const lineLength = utf16Length(line);

    // Skip empty lines
    if (lineLength === 0) {
      perLine.push({ line: lineIdx + 1, coverage: 1 });
      continue;
    }

    totalCharacters += lineLength;

    const segments = (lineIdx < mappings.length ? mappings[lineIdx] : undefined) ?? [];

    if (segments.length === 0) {
      // No mappings on this line — entirely unmapped
      // But only count non-whitespace lines as "unmapped"
      if (line.trim().length > 0) {
        perLine.push({ line: lineIdx + 1, coverage: 0 });
        unmappedRanges.push({
          line: lineIdx + 1,
          startCol: 0,
          endCol: lineLength,
        });
      } else {
        // Whitespace-only lines are considered "covered" (they don't need mapping)
        mappedCharacters += lineLength;
        perLine.push({ line: lineIdx + 1, coverage: 1 });
      }
      continue;
    }

    // Segments partition the line into ranges: [col_i, col_{i+1}).
    // A range is "mapped" when its segment has a sourceIndex (an original position).
    // We walk segments left-to-right, accumulating mapped character counts and
    // tracking gaps (unmapped runs between/around mapped ranges) for reporting.
    // If NO segment on the line has a sourceIndex, the entire line is unmapped
    // (unless it's whitespace-only, which we treat as covered).
    let lineMapped = 0;
    const gaps: { start: number; end: number }[] = [];
    let prevMappedEnd = 0;
    let hasMappedContent = false;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      const start = seg.generatedColumn;
      const end = i + 1 < segments.length ? segments[i + 1]!.generatedColumn : lineLength;

      if (seg.sourceIndex !== undefined) {
        hasMappedContent = true;
        if (start > prevMappedEnd) {
          gaps.push({ start: prevMappedEnd, end: start });
        }
        lineMapped += end - start;
        prevMappedEnd = end;
      }
    }

    if (!hasMappedContent) {
      // No segments have original positions — whole line is unmapped
      if (line.trim().length > 0) {
        unmappedRanges.push({
          line: lineIdx + 1,
          startCol: 0,
          endCol: lineLength,
        });
      } else {
        lineMapped = lineLength;
      }
    } else {
      // Trailing unmapped region after the last mapped segment
      if (prevMappedEnd < lineLength) {
        gaps.push({ start: prevMappedEnd, end: lineLength });
      }

      for (const gap of gaps) {
        unmappedRanges.push({
          line: lineIdx + 1,
          startCol: gap.start,
          endCol: gap.end,
        });
      }
    }

    mappedCharacters += lineMapped;
    perLine.push({
      line: lineIdx + 1,
      coverage: lineLength > 0 ? lineMapped / lineLength : 1,
    });
  }

  return {
    totalCharacters,
    mappedCharacters,
    coveragePercent:
      totalCharacters > 0 ? Math.round((mappedCharacters / totalCharacters) * 10000) / 100 : 100,
    perLine,
    unmappedRanges,
  };
}

function analyzeWasmCoverage(
  mappings: DecodedMappings,
  generatedSource: string,
): CoverageReport {
  const byteLength = generatedSource.length;
  const segments = mappings[0] ?? [];
  const perLine: CoverageLineReport[] = [];
  const unmappedRanges: UnmappedRange[] = [];

  if (byteLength === 0) {
    return {
      totalCharacters: 0,
      mappedCharacters: 0,
      coveragePercent: 100,
      perLine: [],
      unmappedRanges: [],
    };
  }

  let mappedBytes = 0;
  const gaps: { start: number; end: number }[] = [];
  let prevMappedEnd = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const start = seg.generatedColumn;
    const end = i + 1 < segments.length ? segments[i + 1]!.generatedColumn : byteLength;

    if (seg.sourceIndex !== undefined) {
      if (start > prevMappedEnd) {
        gaps.push({ start: prevMappedEnd, end: start });
      }
      mappedBytes += end - start;
      prevMappedEnd = end;
    }
  }

  if (prevMappedEnd < byteLength) {
    gaps.push({ start: prevMappedEnd, end: byteLength });
  }

  for (const gap of gaps) {
    unmappedRanges.push({ line: 1, startCol: gap.start, endCol: gap.end });
  }

  perLine.push({
    line: 1,
    coverage: byteLength > 0 ? mappedBytes / byteLength : 1,
  });

  return {
    totalCharacters: byteLength,
    mappedCharacters: mappedBytes,
    coveragePercent:
      byteLength > 0 ? Math.round((mappedBytes / byteLength) * 10000) / 100 : 100,
    perLine,
    unmappedRanges,
  };
}
