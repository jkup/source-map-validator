import assert from "node:assert";
import { test } from "node:test";

import { parseUnsignedVLQ } from "./vlq.js";

function fromStr(str : string) {
  return str[Symbol.iterator]();
}

test("VLQ tests", () => {
  test("Empty vlq", () => {
    assert.equal(parseUnsignedVLQ(fromStr("")), "eof");
    assert.equal(parseUnsignedVLQ([][Symbol.iterator]()), "eof");
  });

  test("Invalid vlqs", () => {
    assert.equal(parseUnsignedVLQ(fromStr("%")), null);
    assert.equal(parseUnsignedVLQ(fromStr("i")), null);
  });

  test("Simple unsigned vlqs", () => {
    assert.equal(parseUnsignedVLQ(fromStr("A")), 0);
    assert.equal(parseUnsignedVLQ(fromStr("B")), 1);
    assert.equal(parseUnsignedVLQ(fromStr("D")), 3);

    // Extra input is ok, only a single VLQ is read.
    assert.equal(parseUnsignedVLQ(fromStr("AAA")), 0);

    // Errorneous input after the current VLQ is ignored.
    assert.equal(parseUnsignedVLQ(fromStr("A%")), 0);
  });

  test("Continuation bits in vlqs", () => {
    assert.equal(parseUnsignedVLQ(fromStr("iB")), 34);
    assert.equal(parseUnsignedVLQ(fromStr("jC")), 67);
  });
})
