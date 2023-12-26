import type { Token } from "./token.js";

export function tokensMatch(token1: Token | null, token2: Token | null) {
  return token1 && token2 && token1.type.label === token2.type.label;
}
