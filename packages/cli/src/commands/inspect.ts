import fs from 'node:fs';
import { validate, decodeMappings } from 'source-map-validator';
import { RED, GREEN, DIM, BOLD, RESET } from '../colors.js';

export function runInspect(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return 1;
  }

  let sourceMap: string;
  try {
    sourceMap = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(`Cannot read file: ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  const result = validate({ sourceMap });

  console.log('');
  console.log(`${BOLD}Source Map Inspection: ${filePath}${RESET}`);
  console.log('');

  // Stats
  const s = result.stats;
  console.log(`  Version:          3`);
  console.log(`  Mappings:         ${s.mappingCount}`);
  console.log(`  Sources:          ${s.sourceCount}`);
  console.log(`  Names:            ${s.nameCount}`);
  console.log(`  Has sourcesContent: ${s.hasSourcesContent}`);
  console.log(`  Has ignoreList:   ${s.hasIgnoreList}`);
  console.log(`  Is index map:     ${s.isIndexMap}`);

  if (s.extensions.length > 0) {
    console.log(`  Extensions:       ${s.extensions.join(', ')}`);
  }

  // Parse and show sources list
  try {
    const parsed = JSON.parse(sourceMap);
    if (Array.isArray(parsed.sources)) {
      console.log('');
      console.log(`  ${BOLD}Sources:${RESET}`);
      for (let i = 0; i < parsed.sources.length; i++) {
        const ignored = parsed.ignoreList?.includes(i) ? ` ${DIM}(ignored)${RESET}` : '';
        const hasContent =
          parsed.sourcesContent?.[i] !== null && parsed.sourcesContent?.[i] !== undefined
            ? ` ${GREEN}✓${RESET}`
            : ` ${RED}✗${RESET}`;
        console.log(`    [${i}] ${parsed.sources[i] ?? '(null)'}${hasContent}${ignored}`);
      }
    }

    // Show first few decoded mappings
    if (typeof parsed.mappings === 'string') {
      const { mappings } = decodeMappings(parsed.mappings);
      console.log('');
      console.log(`  ${BOLD}First 10 mappings:${RESET}`);
      let count = 0;
      for (let lineIdx = 0; lineIdx < mappings.length && count < 10; lineIdx++) {
        for (const seg of mappings[lineIdx]!) {
          if (count >= 10) break;
          const parts: string[] = [`gen ${lineIdx + 1}:${seg.generatedColumn}`];
          if (seg.sourceIndex !== undefined) {
            const source = parsed.sources?.[seg.sourceIndex] ?? `source[${seg.sourceIndex}]`;
            parts.push(`→ ${source}:${(seg.originalLine ?? 0) + 1}:${seg.originalColumn ?? 0}`);
          }
          if (seg.nameIndex !== undefined) {
            parts.push(`name="${parsed.names?.[seg.nameIndex] ?? `[${seg.nameIndex}]`}"`);
          }
          console.log(`    ${parts.join(' ')}`);
          count++;
        }
      }
    }
  } catch {
    console.log(`  ${RED}Could not parse source map JSON${RESET}`);
  }

  console.log('');
  return 0;
}
