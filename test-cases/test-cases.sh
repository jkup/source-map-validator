#!/bin/bash

# Test Case 1: Valid source map with project1
node ./src/index.mjs --sourceMap test-projects/project1/project1.js.map --generatedFile test-projects/project1/project1.generated.js --originalFolder test-projects/project1/original

# Test Case 2: Invalid source map format with project2
node ./src/index.mjs --sourceMap test-projects/project2/project2.js.map --generatedFile test-projects/project2/project2.generated.js --originalFolder test-projects/project2/original

# Test Case 3: Missing original file in project3
node ./src/index.mjs --sourceMap test-projects/project3/project3.js.map --generatedFile test-projects/project3/project3.generated.js --originalFolder test-projects/project3/original
