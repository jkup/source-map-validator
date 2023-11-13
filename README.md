# Source Map Validator

## What is this project?

`source-map-validator` is a Node.js CLI that validates the correctness of a source map file. It checks if the mappings in the source map file are valid and if they correctly map to the original source files.

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

### Validators

The project uses a series of validators to check the integrity of source maps:

1. **Format Validator**: Ensures the source map is in the correct format.
2. **Source File Validator**: Checks that all referenced source files exist and are accessible.
3. **Mapping Validator**: Verifies that mappings accurately point to the correct locations in the source files.

Each validator is modular and designed to handle a specific aspect of source map validation.

## How Tests Work

Testing is done using a bash script for end-to-end tests.

**test-cases.sh**: This script contains a series of commands to run the CLI tool with various test projects, simulating real-world usage scenarios.

To run the tests:

```sh
./test-cases.sh
```

Make sure the script is executable. If not, run `chmod +x test-cases.sh`.
