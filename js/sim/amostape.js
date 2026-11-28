// SPDX-License-Identifier: Apache-2.0
//
// AMOS magnetic tapes, as M. Howard's images hold them (MH25, magtapes/*.tape;
// research/ncsu-tapes.md): each 30-bit word in a 32-bit little-endian word, each record preceded
// by a word with its top bit set that gives the record's length in 6-bit frames (five a word),
// an all-ones word at the end of the tape.
//
// A record starts with four words: the record and file numbers; the file's name (five 6-bit
// characters); the date (bits 1-5 the year from 1964, 6-9 the month, 10-14 the day) and the
// length of the record's data (15 bits); and the file's type (bits 0-3), version (4-8),
// revision (9-14) and origin (15-29). The data follows, then a checksum. Records of one file
// share its file number and name. In a DUMP file each record's origin is where its words go in
// core, as BROSE's are on the games tape (R24).

import { TTY } from "./amoscode.js";

export const TYPES = ["SYMS", "DATA", "RELOC", "ASCII", "TEXT", "RLSYM", "PRNTR", "ATEXT", "BIN", "DUMP", "DISK", "MACRO", "T14", "T15", "T16", "T17"];
const NAME_CHARS = ` ${TTY.map((c) => (c === "\r" ? "\n" : c)).join("").slice(1)}`;
const MONTHS = ["?", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "?", "?", "?"];
const M30 = 0o7777777777;

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
 * @property {number[]} origins each record's origin: for a DUMP file, where its words go in core
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
        origins: [],
      };
      files.push(cur);
    }
    const data = [];
    for (let j = i + 5; j < i + 5 + body && j < n; j++) data.push(at(j) & M30);
    cur.words.push(...data);
    cur.records.push(data);
    cur.origins.push(typeEtc & 0o77777);
    i += len + 1;
  }
  return files;
}

/**
 * A DUMP file's records, each with the address its words go to.
 * @param {TapeFile} f
 * @returns {{ addr: number; words: Uint32Array }[]}
 */
export const dumpOf = (f) => f.records.map((words, k) => ({ addr: f.origins[k], words: Uint32Array.from(words) }));
