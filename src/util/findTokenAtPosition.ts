import { type Token } from "./token";

export function findTokenAtPosition(
  tokens: any[] | null | undefined,
  line: number,
  column: number
): Token | null {
  if (!tokens) {
    return null;
  }
  return tokens.find(
    (token) =>
      token.loc.start.line === line && token.loc.start.column === column
  );
}
