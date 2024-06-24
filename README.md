# Source Map Validator

## What is this project?

`source-map-validator` is a Node.js CLI that validates the correctness of a source map file. It checks if the mappings in the source map file are valid and if they correctly map to the original source files.

Heavily inspired by https://github.com/ben-ng/sourcemap-validator and https://github.com/getsentry/sourcemaps.io.

## Installation

To install the tool as a global package:

```sh
npm install -g [todo]
```

This will install the CLI tool globally on your system, allowing you to run it from anywhere in your command line.

## Usage

```sh
npx [todo-name-tool] --sourceMap sourcemap.js.map --generatedFile generated.js --originalFolder src/
```

## How the Project Works

### Contributing

1. Clone the repo
1. Run `npm install`
1. Run `git submodule init`
1. Run `git submodule update`

From there, you can run tests with `npm test` or make a build with `npm run build`.

### Validators

The project uses a series of validators to check the integrity of source maps:

1. **Format Validator**: Ensures the source map is in the correct format.
2. **Source File Validator**: Checks that all referenced source files exist and are accessible.
3. **Mapping Validator**: Verifies that mappings accurately point to the correct locations in the source files.

Each validator is modular and designed to handle a specific aspect of source map validation.

## How Tests Work

The test files are generated from https://github.com/kamilogorek/sourcemaps-playground. They should be updated to have more interesting cases and eventually to include our new features like scopes and debug IDs.

Testing is done using a bash script for end-to-end tests.

**test-cases.sh**: This script contains a series of commands to run the CLI tool with various test projects, simulating real-world usage scenarios.

To run the tests:

```sh
./test-cases.sh
```

Make sure the script is executable. If not, run `chmod +x test-cases.sh`.
