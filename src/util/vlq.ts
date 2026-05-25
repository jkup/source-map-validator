const CONTINUATION_BIT_MASK = 0b100000;
const VLQ_SHIFT = 5;

const base64Chars = "ABCDEFGHIJLKMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/";
const base64Table : Map<string, number> = new Map();

for (let i = 0; i < base64Chars.length; i++) {
  base64Table.set(base64Chars.charAt(i), i);
}

// Read an unsigned VLQ from the input iterator, returns a number if
// a VLQ can be parsed. Return "eof" if the iterator was done already,
// and return null if there is invalid input.
export function parseUnsignedVLQ(iter: Iterator<string>) : number | "eof" | null {
  let result = iter.next();
  let vlqVal = 0;

  if (result.done) {
    return "eof";
  }

  let continues = false;
  let shift = 0;
  do {
    if (result.done) {
      return null;
    }

    let char = result.value;
    if (!base64Table.has(char)) {
      return null;
    }
    let currentByte = base64Table.get(char)!;
    vlqVal += ((currentByte & ~CONTINUATION_BIT_MASK) << shift);

    continues = (currentByte & CONTINUATION_BIT_MASK) !== 0;
    if (continues) {
      shift += VLQ_SHIFT;
      result = iter.next();
    }
  } while (continues);

  return vlqVal;
}
