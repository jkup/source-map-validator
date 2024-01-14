import type { SourceMap } from "./sourceMap.js";

export class ValidationContext {
   static from(
       sourceMapPath: string,
       originalFolderPath: string,
       generatedFilePath: string,
   ): ValidationContext {
       return new ValidationContext(
           sourceMapPath,
           originalFolderPath,
           generatedFilePath
       )
   }

   public sourceMap!: SourceMap;

   private constructor(
       public readonly sourceMapPath: string,
       public readonly originalFolderPath: string,
       public readonly generatedFilePath: string,
   ) {}
}