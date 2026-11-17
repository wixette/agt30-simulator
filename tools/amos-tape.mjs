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

export const TYPES = ["SYMS", "DATA", "RELOC", "ASCII", "TEXT", "RLSYM", "PRNTR", "ATEXT", "BIN", "DUMP", "DISK", "MACRO", "T14", "T15", "T16", "T17"];
/**
 * AMOS's 6-bit characters as the Teletype prints them (js/sim/amoscode.js; ADEPT pp. 23-24):
 * "\t" tab, "\n" end of line, "\\" (07) ADEPT's concatenation, "←" (77) backspace.
 */
export const CHARS = TTY.map((c) => (c === "\r" ? "\n" : c)).join("");
const NAME_CHARS = ` ${CHARS.slice(1)}`;
const MONTHS = ["?", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "?", "?", "?"];
const M30 = 0o7777777777;
/** The editor's page mark. */
const PAGE = 0o7777700000;

/**
 * @typedef {object} TapeFile
 * @property {number} file the file number
 * @property {string} name
 * @property {string} type
 * @property {number} version
 * @property {number} revision
 * @property {number} origin
 * @property {string} date day/month/year
 * @property {number[]} words the data of all its records, 30 bits each
 * @property {number[][]} records the data of each record
 */

/**
 * A file name: five 6-bit characters.
 * @param {number} w
 * @returns {string}
 */
export function fileName(w) {
  let s = "";
  for (const shift of [24, 18, 12, 6, 0]) s += NAME_CHARS[Math.floor(w / 2 ** shift) & 0o77];
  return s.trim();
}

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

/**
 * The files on a tape image.
 * @param {Uint8Array} bytes
 * @returns {TapeFile[]}
 */
export function readTape(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.floor(bytes.byteLength / 4);
  const at = (/** @type {number} */ i) => view.getUint32(i * 4, true);
  /** @type {TapeFile[]} */
  const files = [];
  /** @type {TapeFile | null} */
  let cur = null;
  let key = "";
  let i = 0;
  while (i < n && at(i) !== 0xffffffff) {
    const mark = at(i);
    if (!(mark & 0xc0000000)) throw new Error(`word ${i}: no record mark`);
    const frames = mark & 0xffff;
    const len = Math.ceil(frames / 5);
    const [rec, name, dateSize, typeEtc] = [at(i + 1), at(i + 2), at(i + 3), at(i + 4)];
    const body = dateSize & 0o77777;
    const k = `${rec & 0o77777}/${name}`;
    if (!cur || k !== key) {
      key = k;
      cur = {
        file: rec & 0o77777,
        name: fileName(name),
        type: TYPES[(typeEtc >>> 26) & 0o17],
        version: (typeEtc >>> 21) & 0o37,
        revision: (typeEtc >>> 15) & 0o77,
        origin: typeEtc & 0o77777,
        date: `${(dateSize >>> 15) & 0o37}/${MONTHS[(dateSize >>> 20) & 0o17]}/${((dateSize >>> 24) & 0o37) + 1964}`,
        words: [],
        records: [],
      };
      files.push(cur);
    }
    const data = [];
    for (let j = i + 5; j < i + 5 + body && j < n; j++) data.push(at(j) & M30);
    cur.words.push(...data);
    cur.records.push(data);
    i += len + 1;
  }
  return files;
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
