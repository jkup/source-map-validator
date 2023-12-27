import { extname } from "path";
import { readFileSync } from "fs";

export abstract class TestingFile {
  static forTextFile(path: string, content: string | undefined | null = null) {
    return new TestingTextFile(path, content);
  }

  static fromPathBasedOnFileExtension(path: string) {
    switch (extname(path)) {
      case ".wasm": return new TestingWasmBinaryFile(path);
      default: return new TestingTextFile(path)
    }
  }

  constructor(public readonly path: string) {}

  abstract isMappingReasonable(lineNumber: number, columnNumber: number): boolean
}

class TestingTextFile extends TestingFile {
  private content!: string;
  private lines!: string[];

  constructor(path: string, content: string | undefined | null = undefined) {
    super(path);
    if (content != null) this.content = content;
  }

  private getContent(): string {
      if (this.content === undefined) {
        this.content = readFileSync(this.path, "utf8");
      }
      return this.content;
  }

  private getLines(): string[] {
      if (this.lines === undefined) {
        this.lines = this.getContent().split(/\r?\n/g);
      }
      return this.lines;
  }

  isMappingReasonable(lineNumber: number, columnNumber: number): boolean {
    // The tested source maps have one-based line numbers, I'm not sure about it
    const line = this.getLines()[lineNumber - 1];
    return line !== undefined && line[columnNumber] !== undefined;
  }
}

class TestingWasmBinaryFile extends TestingFile {
  private content!: Uint8Array

  private getContent(): Uint8Array {
    if (this.content === undefined) {
      this.content = readFileSync(this.path);
    }
    return this.content;
  }

  isMappingReasonable(lineNumber: number, columnNumber: number): boolean {
    // The tested source maps have one-based line numbers, I'm not sure about it
    return lineNumber === 1 && this.getContent()[columnNumber] !== undefined;
  }
}
