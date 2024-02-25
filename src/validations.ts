import { compose } from "./util/ComposedValidator.js";
import { validation } from "./util/ValidatorConfiguration.js";
import { SourceFilesValidator } from "./validators/SourceFilesValidator.js";
import { SourceMapJSONValidator } from "./validators/SourceMapJSONValidator.js";
import { SourceMapFormatValidator } from "./validators/SourceMapFormatValidator.js";
import { SourceMapMappingsValidator } from "./validators/SourceMapMappingsValidator.js";
import {SourceMapScopesValidator} from "./validators/SourceMapScopesValidator.js";

const sourceMapJSONValidation = validation({
    validator: SourceMapJSONValidator,
    name: "SourceMapJSONValidator",
    description: "Check that the provided source map represented as a valid JSON format",
})

const sourceMapFormatValidation = validation({
    validator: SourceMapFormatValidator,
    name: "SourceMapFormatValidator",
    description: "Check that all the defined source map fields have valid types",
    prerequisites: [sourceMapJSONValidation]
})

const sourceFilesValidation = validation({
    validator: SourceFilesValidator,
    name: "SourceFilesValidator",
    description: "Check that the `sources` section contains a file path placed on disk or a `sourcesContent` element for its content",
    prerequisites: [sourceMapJSONValidation, sourceMapFormatValidation]
})

const sourceMapMappingsValidation = validation({
    validator: SourceMapMappingsValidator,
    name: "SourceMapMappingsValidator",
    description: "Check that `mappings` field contains correctly encoded segments that map tokens with the same type",
    prerequisites: [sourceMapJSONValidation, sourceMapFormatValidation, sourceFilesValidation]
})

const sourceMapScopesValidation = validation({
    validator: SourceMapScopesValidator,
    name: "SourceMapScopesValidator",
    description: "Check that `originalScopes` and `generatedRanges` fields contain correctly encoded segments",
    prerequisites: [sourceMapJSONValidation, sourceMapFormatValidation, sourceFilesValidation]
})

export default compose(
    sourceMapJSONValidation,
    sourceMapFormatValidation,
    sourceFilesValidation,
    sourceMapMappingsValidation,
    sourceMapScopesValidation
)