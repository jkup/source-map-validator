import fs from "fs";
import {parse} from "@babel/parser";

type ParsingResult = ReturnType<typeof parse>;

export class TestingFile {
  static fromPath(path: string) {
    return new TestingFile(path)
  }

  private text!: string;
  private ast!: ParsingResult;

  public constructor(public readonly path: string) {}

  public getText(): string {
    if (this.text === undefined) {
      this.text = fs.readFileSync(this.path, "utf8")
    }
    return this.text;
  }

  public getAst(): ParsingResult {
    if (this.ast === undefined) {
      this.ast = parse(this.getText(), {
        sourceType: "module",
        tokens: true,
      })
    }
    return this.ast;
  }
}
