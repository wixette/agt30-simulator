// SPDX-License-Identifier: Apache-2.0
//
// Tests for the pairing of source and binary (tools/dpr2-pairs.mjs), on a routine made up here:
// nothing from the NCSU tapes is kept in the repository.

import assert from "node:assert/strict";
import { test } from "node:test";
import { encode, evaluate, pairRoutine, statements, trusted } from "./dpr2-pairs.mjs";

const ONES = 0o7777777777;
const NAME = 0o1234567012;
/** An instruction word: its upper half and its address. @param {number} op @param {number} addr */
const word = (op, addr) => op * 2 ** 15 + addr;

const SOURCE = [
  "\tTITLE\tTEST",
  "\tENTRY\tGO",
  "GO:\tJUMP\t.\t[ENTRY",
  "\tFPRI",
  "\tMDAR\tX\t[FETCH",
  "\tARMD'I\tY",
  "X:\t0",
  "Y:\t0",
  "\tTERMINATE",
].join("\n");

/** The binary as the assembler writes it: an entry pair, the words, then the length. */
const BINARY = [
  [NAME, ONES, ONES, 0o0100000000, NAME,
    word(0o40, 0), word(0o360, 0), word(0o21000, 4), word(0o20101, 5), 0, 0, 0o6000000006, ONES],
];
const SYMBOLS = new Map([["GO", 0], ["X", 4], ["Y", 5]]);

test("statements: labels, operations, operands and comments", () => {
  const { statements: sts } = statements(SOURCE);
  assert.deepEqual(sts.slice(2, 5).map((s) => [s.label, s.op, s.operand]), [["GO", "JUMP", "."], [null, "FPRI", ""], [null, "MDAR", "X"]]);
});

test("operands: labels, here, octal and decimal numbers, ones' complement", () => {
  const syms = new Map([["X", 4]]);
  assert.equal(evaluate("X+1", syms, 0, new Set()), 5);
  assert.equal(evaluate(".-1", syms, 7, new Set()), 6);
  assert.equal(evaluate("96.", syms, 0, new Set()), 96);
  assert.equal(evaluate("-1", syms, 0, new Set()), 0o77776);
  assert.equal(evaluate("$EXT", syms, 0, new Set()), 0);
  assert.equal(evaluate("Z", syms, 0, new Set()), null);
});

test("a routine pairs from its labels; a statement with nothing to check is trusted between matches", () => {
  const { pairs, length } = pairRoutine({ name: "TEST", file: 1, source: SOURCE, binary: BINARY, symbols: SYMBOLS });
  assert.equal(length, 6);
  assert.deepEqual(pairs.slice(0, 4).map((p) => [p.addr, p.op, p.match]), [[0, "JUMP", true], [1, "FPRI", null], [2, "MDAR", true], [3, "ARMD'I", true]]);
  assert.deepEqual(trusted(pairs).map((p) => p.op), ["JUMP", "FPRI", "MDAR", "ARMD'I"]);
  for (const p of trusted(pairs)) assert.equal(encode(p.op), Math.floor(p.word / 2 ** 15));
});

test("the layout: kind, destination, source, rotation, logic, 'X and 'I", () => {
  assert.equal(encode("MDAR"), 0o21000);
  assert.equal(encode("ARMD"), 0o20100);
  assert.equal(encode("MDAR'I'X"), 0o21003);
  assert.equal(encode("MDAR'H'O"), 0o21064);
  assert.equal(encode("MDAE'L"), 0o56000);
  assert.equal(encode("ARXO'F"), 0o77100);
  assert.equal(encode("S5AR'H'A'F"), 0o61570);
  assert.equal(encode("MD10"), 0o30000);
  assert.equal(encode("JUMP'I"), 0o41);
  assert.equal(encode("ANAR'O"), 0o1264);
  assert.equal(encode("JUMP'F"), null);
  assert.equal(encode("MDAR'A'N"), null);
  assert.equal(encode("BUFF"), null);
});
