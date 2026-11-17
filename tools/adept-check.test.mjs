// SPDX-License-Identifier: Apache-2.0
//
// Tests for the assembler check (tools/adept-check.mjs), on sequences made up here: nothing from
// the NCSU tapes is kept in the repository.

import assert from "node:assert/strict";
import { test } from "node:test";
import { align, items, leftOver } from "./adept-check.mjs";

const ONES = 0o7777777777;

test("a record's items are its words less the framing", () => {
  assert.deepEqual(items([[0o123, ONES, 0o5252, 1, 2, 3, ONES], [0o123, ONES, 0, 4]]), [1, 2, 3, 4]);
});

test("alignment finds our words among the binary's, in order", () => {
  const a = align([10, 20, 30], [0o0100000000, 0o1234, 10, 20, 0o1100000222, 30, 0o6000000003]);
  assert.equal(a.common, 3);
  assert.deepEqual(a.onlyA, []);
  assert.deepEqual(a.onlyB, [0, 1, 4, 6]);
  assert.deepEqual(align([10, 99, 30], [10, 20, 30]).onlyA, [1]);
});

test("the items left over are counted by kind", () => {
  const theirs = [0o0100000000, 0o1234, 10, 0o0200000005, 0o4321, 0o1100000222, 0o6000000003, 0o77];
  assert.deepEqual(leftOver(theirs, [0, 1, 3, 4, 5, 6, 7]), { "01 pair": 1, "02 pair": 1, "11 item": 1, "60 item": 1, other: 1 });
});
