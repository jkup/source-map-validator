export function findTokenAtPosition(tokens, line, column) {
  return tokens.find(
    (token) =>
      token.loc.start.line === line && token.loc.start.column === column
  );
}
