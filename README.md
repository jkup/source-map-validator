# source-map-validator

A comprehensive source map validator that checks format, mappings, coverage, and semantic accuracy against [ECMA-426](https://tc39.es/ecma426/).

## What it validates

**Level 1 — Format (source map only)**

- Valid JSON, `version` is integer `3`, required fields present
- Field types (sources, sourcesContent, names, mappings, ignoreList)
- sourcesContent/sources length match, ignoreList bounds
- VLQ encoding validity (characters, continuations, segment field counts)
- Mapping index bounds, column ordering, non-negative positions
- Index map section validity

**Level 2 — Generated file (+ generated JS/CSS)**

- sourceMappingURL comment present
- Mappings within generated file bounds
- Coverage analysis (% of generated code with mapping coverage)

**Level 3 — Deep validation (+ original sources)**

- Mappings within original source bounds
- Token matching (named mappings point to correct identifiers)
- sourcesContent vs. file consistency
- Round-trip accuracy

**Level 4 — Advisory (always runs)**

- Absolute paths, backslash paths
- Missing sourcesContent/ignoreList
- Deprecated `x_google_ignoreList`
- Extension fields

## Install

```bash
npm install source-map-validator
```

## CLI Usage

```bash
# Basic validation
npx sourcemap-validator validate app.js.map

# With generated file (enables Level 2 + coverage)
npx sourcemap-validator validate app.js.map --generated=app.js

# Deep validation with original sources
npx sourcemap-validator validate app.js.map --generated=app.js --sources-dir=./src

# Output formats: pretty (default), json, github
npx sourcemap-validator validate app.js.map --format=json

# Inspect: show decoded mappings and stats
npx sourcemap-validator inspect app.js.map

# Coverage report
npx sourcemap-validator coverage app.js.map app.js

# Feature flags
npx sourcemap-validator validate app.js.map --disable=has-sources-content
npx sourcemap-validator validate app.js.map --only=vlq-valid,mapping-index-bounds
npx sourcemap-validator validate app.js.map --preset=strict   # warnings become errors
npx sourcemap-validator validate app.js.map --preset=minimal  # spec violations only

# Proposals (opt-in validation for TC39 proposals not yet in the spec)
npx sourcemap-validator validate app.js.map --proposals=scopes
```

## Library API

```typescript
import { validate } from 'source-map-validator';

const result = validate({
  sourceMap: fs.readFileSync('app.js.map', 'utf-8'),
  generatedSource: fs.readFileSync('app.js', 'utf-8'), // optional
  originalSources: { 'src/app.ts': '...' }, // optional
  preset: 'strict', // optional
  rules: { 'has-sources-content': false }, // optional
  proposals: ['scopes'], // optional — enable TC39 proposal validation
});

console.log(result.valid); // boolean
console.log(result.errors); // Diagnostic[]
console.log(result.warnings); // Diagnostic[]
console.log(result.coverage); // CoverageReport | undefined
console.log(result.stats); // SourceMapStats
```

## Validation Rules

| Rule                           | Level | Severity | Description                               |
| ------------------------------ | ----- | -------- | ----------------------------------------- |
| `valid-json`                   | 1     | error    | Source map must be valid JSON             |
| `version-field`                | 1     | error    | `version` must be integer 3               |
| `required-fields`              | 1     | error    | `version`, `sources`, `mappings` required |
| `field-types`                  | 1     | error    | All fields have correct types             |
| `sources-content-length`       | 1     | error    | `sourcesContent` length matches `sources` |
| `ignore-list-bounds`           | 1     | error    | `ignoreList` indices within bounds        |
| `vlq-valid`                    | 1     | error    | Valid Base64 VLQ characters               |
| `segment-field-count`          | 1     | error    | Segments have 1, 4, or 5 fields           |
| `mapping-index-bounds`         | 1     | error    | Source/name indices within bounds         |
| `column-ordering`              | 1     | error    | Columns ascending within each line        |
| `non-negative-positions`       | 1     | error    | All positions non-negative                |
| `index-map-valid`              | 1     | error    | Index map sections valid                  |
| `mappings-in-generated-bounds` | 2     | error    | Mappings within generated file            |
| `source-mapping-url`           | 2     | warning  | sourceMappingURL comment present          |
| `mappings-in-original-bounds`  | 3     | error    | Mappings within original sources          |
| `token-matching`               | 3     | warning  | Named mappings match tokens               |
| `sources-content-consistency`  | 3     | warning  | sourcesContent matches files              |
| `no-absolute-paths`            | 4     | warning  | No absolute filesystem paths              |
| `no-backslash-paths`           | 4     | warning  | No backslash path separators              |
| `has-sources-content`          | 4     | warning  | sourcesContent present                    |
| `has-ignore-list`              | 4     | info     | ignoreList for third-party code           |
| `deprecated-x-google`          | 4     | info     | Deprecated x_google_ignoreList            |
| `sources-resolvable`           | 4     | warning  | Each source resolvable via content        |
| `extension-fields`             | 4     | info     | Non-standard fields present               |

### Proposal Rules (opt-in via `--proposals`)

These rules validate TC39 proposals that are not yet part of the ECMA-426 specification. They are disabled by default and must be explicitly enabled.

| Rule                       | Level | Severity | Proposal | Description                           |
| -------------------------- | ----- | -------- | -------- | ------------------------------------- |
| `scopes-field-type`        | 1     | error    | scopes   | `scopes` must be a string             |
| `scopes-decode-valid`      | 1     | error    | scopes   | VLQ/structural decoding succeeds      |
| `scopes-tree-balanced`     | 1     | error    | scopes   | Scope/range trees properly nested     |
| `scopes-names-bounds`      | 1     | error    | scopes   | Name indices within bounds            |
| `scopes-sources-bounds`    | 1     | error    | scopes   | Source indices and tree count valid   |
| `scopes-positions-ordered` | 1     | error    | scopes   | Start positions precede end positions |
| `scopes-range-bounds`      | 2     | error    | scopes   | Generated ranges within file bounds   |
| `scopes-original-bounds`   | 3     | error    | scopes   | Original scopes within source bounds  |

## Presets

- **`strict`** — All rules, warnings treated as errors
- **`ci`** — All rules enabled (default behavior)
- **`minimal`** — Only ECMA-426 spec violations (Level 1 errors)

## Project Structure

```
packages/
  core/    — Validation engine (zero runtime dependencies)
  cli/     — CLI tool (commander)
  web/     — Web playground (planned)
```

## License

MIT
