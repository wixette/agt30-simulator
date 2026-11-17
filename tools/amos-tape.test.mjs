// SPDX-License-Identifier: Apache-2.0
//
// Tests for the tape reader (tools/amos-tape.mjs), on a tape made up here: no image from the
// NCSU tapes is kept in the repository.

import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARS, fileName, readTape, text } from "./amos-tape.mjs";

/** Packs five 6-bit codes into a word. @param {number[]} c */
const pack = (c) => c.reduce((w, x) => w * 64 + x, 0);
/** A word of text: up to five characters, padded with the end-of-line code. @param {string} s */
const chars = (s) => pack([...s.padEnd(5, "\n")].map((ch) => CHARS.indexOf(ch)));
const NAME = (/** @type {string} */ s) => pack([...s.padEnd(5, " ")].map((ch) => (ch === " " ? 0 : CHARS.indexOf(ch))));

/**
 * A record as the images hold it: a mark with its length in frames, four header words, the
 * data and a checksum.
 * @param {number} file
 * @param {string} name
 * @param {number} type
 * @param {number[]} data
 */
function record(file, name, type, data) {
  const date = ((1971 - 1964) * 2 ** 24) + 5 * 2 ** 20 + 19 * 2 ** 15 + data.length;
  const words = [file, NAME(name), date, type * 2 ** 26 + 1 * 2 ** 21 + 0o33 * 2 ** 15, ...data, 0];
  return [0x80000000 + words.length * 5, ...words];
}

/** @param {number[]} words */
function image(words) {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((w, i) => view.setUint32(i * 4, w >>> 0, true));
  return bytes;
}

test("a file's records are joined, and its header read", () => {
  const tape = image([
    ...record(0o11, "AMLD0", 7, [chars("JUMP\n"), chars("\n")]),
    ...record(0o11, "AMLD0", 7, [chars("ARMD\n")]),
    ...record(0o12, "AMLD0", 2, [0o0004000000]),
    0xffffffff,
  ]);
  const files = readTape(tape);
  assert.equal(files.length, 2);
  const [src, bin] = files;
  assert.deepEqual([src.file, src.name, src.type, src.version, src.revision, src.date], [0o11, "AMLD0", "ATEXT", 1, 0o33, "19/MAY/1971"]);
  assert.equal(src.records.length, 2);
  assert.equal(src.words.length, 3);
  assert.equal(bin.type, "RELOC");
  assert.deepEqual(bin.words, [0o0004000000]);
});

test("source text: a line ends with character 15 and the rest of its word is filler", () => {
  assert.equal(text([chars("MDAR\t"), chars("X\n"), chars("\n")]), "MDAR\tX\n\n");
  assert.equal(fileName(NAME("FSRR")), "FSRR");
});

test("a word without a record mark is an error", () => {
  assert.throws(() => readTape(image([0o123, 0xffffffff])), /no record mark/);
});
