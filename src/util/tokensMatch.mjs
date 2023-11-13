export function tokensMatch(token1, token2) {
  return token1.type.label === token2.type.label;
}
