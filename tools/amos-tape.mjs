// SPDX-License-Identifier: Apache-2.0
//
// Reads an AMOS magnetic tape image, for study (research/ncsu-tapes.md).
//
//     node tools/amos-tape.mjs TAPE              (list the files)
//     node tools/amos-tape.mjs TAPE --out DIR    (also write each file into DIR)
//
// The images are those of M. Howard's repository (MH25, magtapes/*.tape): each 30-bit word is
// held in a 32-bit little-endian word, and each record is preceded by a word with its top bit
// set that gives the record's length in 6-bit frames (five a word). An all-ones word ends the
// tape. No image is kept in this repository; this tool reads one from wherever it is.
//
// A record starts with four words: the record and file numbers; the file's name (five 6-bit
// characters); the date (bits 1-5 the year from 1964, 6-9 the month, 10-14 the day) and the
// length of the record's data (15 bits); and the file's type (bits 0-3), version (4-8),
// revision (9-14) and origin (15-29). The data follows, then a checksum. Records of one file
// share its file number and name.
//
// ADEPT source (ATEXT) is 6-bit characters, five a word; a line ends with character 15 (octal)
// and the rest of its word is filler, so each line starts a word. A word of two backspaces, an X
// and two nulls (7777700000) marks a new page; it is not text, and is left out.
//
// Written out: ATEXT as text, NNN-NAME.ATEXT.txt;
// any other type as one octal word a line, NNN-NAME.TYPE.oct (NNN the file number in octal).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { TTY } from "../js/sim/amoscode.js";
import { fileName, readTape, TYPES } from "../js/sim/amostape.js";

export { fileName, readTape, TYPES };

/**
 * AMOS's 6-bit characters as the Teletype prints them (js/sim/amoscode.js; ADEPT pp. 23-24):
 * "\t" tab, "\n" end of line, "\\" (07) ADEPT's concatenation, "←" (77) backspace.
 */
export const CHARS = TTY.map((c) => (c === "\r" ? "\n" : c)).join("");
/** The editor's page mark. */
const PAGE = 0o7777700000;

/**
 * ADEPT source as text.
 * @param {number[]} words
 * @returns {string}
 */
export function text(words) {
  let s = "";
  for (const w of words) {
    if (w === PAGE) continue;
    for (const shift of [24, 18, 12, 6, 0]) {
      const c = Math.floor(w / 2 ** shift) & 0o77;
      s += CHARS[c];
      if (c === 0o15) break;
    }
  }
  return s;
}


/** @param {number} v @param {number} w @returns {string} */
const oct = (v, w) => v.toString(8).padStart(w, "0");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string" } } });
  if (positionals.length !== 1) {
    console.error("usage: node tools/amos-tape.mjs TAPE [--out DIR]");
    process.exit(2);
  }
  const files = readTape(readFileSync(positionals[0]));
  if (values.out) mkdirSync(values.out, { recursive: true });
  for (const f of files) {
    console.log(`${oct(f.file, 5)} ${f.name.padEnd(5)} ${f.type.padEnd(5)} v${f.version} r${f.revision} ${f.date.padEnd(11)} origin ${oct(f.origin, 5)} ${String(f.words.length).padStart(6)} words`);
    if (!values.out) continue;
    const base = join(values.out, `${oct(f.file, 3)}-${f.name}.${f.type}`);
    if (f.type === "ATEXT") writeFileSync(`${base}.txt`, text(f.words));
    else writeFileSync(`${base}.oct`, f.words.map((w) => oct(w, 10)).join("\n") + "\n");
  }
}
