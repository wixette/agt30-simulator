// SPDX-License-Identifier: Apache-2.0
//
// Listings of core for the Processor tab (docs/ui-design.md, U15): a run of words read as DPR-2
// instructions, with the assembler's symbols for their addresses; as DSPLY's image items; or as
// plain words, in octal and as AMOS characters. Only a reading: nothing here changes core.
// Whether a word is an instruction, an item or data is the reader's choice, as with any
// disassembler.

import { unpackText } from "./amoscode.js";
import { disassemble, ENCODING, get, KIND, opName } from "./dpr2.js";
import { decode, itemText } from "./image.js";
import { lo, M15, oct } from "./words.js";

/** @typedef {import("./image.js").Core} Core */

/** How a listing reads the words. */
export const MODES = /** @type {const} */ (["code", "items", "words"]);
/** @typedef {typeof MODES[number]} Mode */

/**
 * One line of a listing.
 * @typedef {object} Line
 * @property {number} addr its first word's address
 * @property {number} len how many words it takes
 * @property {string} label a symbol defined at the address, or ""
 * @property {number[]} words
 * @property {string} text the reading, without its operand
 * @property {string} operand the operand as written: a symbol, a symbol plus an offset, or octal
 * @property {number | null} ref the address the operand names, when it names one
 */

/** Special instructions whose address field is an address. */
const ADDRESSED = new Set(["JPSR", "JUMP", "JSAN", "JPAN", "JSLS", "JPLS", "MPYU", "MPYL", "DIVU", "DIVL"]);
/** How far past a symbol an address is still written as SYMBOL+N. */
const NEAR = 0o20;

/**
 * The symbols by value: the first name defined for each address.
 * @param {Core} core
 * @returns {Map<number, string>}
 */
export function namesByAddress(core) {
  /** @type {Map<number, string>} */
  const names = new Map();
  for (const [name, v] of core.symbols) if (!names.has(v)) names.set(v, name);
  return names;
}

/**
 * An address as a symbol, a symbol plus an offset in octal, or octal.
 * @param {number} a
 * @param {Map<number, string>} names
 * @returns {string}
 */
export function symbolic(a, names) {
  const exact = names.get(a);
  if (exact) return exact;
  for (let d = 1; d < NEAR && a - d >= 0; d++) {
    const n = names.get(a - d);
    if (n) return `${n}+${d.toString(8)}`;
  }
  return oct(a, 5);
}

/**
 * Whether an instruction's address field is an address (so a symbol may name it), and so worth
 * following: a transfer from memory, a jump, a conditional transfer, or the EAU's memory forms.
 * @param {number} w
 * @returns {boolean}
 */
export function isAddressed(w) {
  const kind = get(w, ENCODING.kind);
  if (kind === KIND.MEMORY) return true;
  if (kind !== KIND.OTHER) return false;
  const op = opName(w);
  return op === undefined ? /^(AN|LS)/.test(disassemble(w)) : ADDRESSED.has(op);
}

/**
 * A word read as an instruction.
 * @param {number} w
 * @param {Map<number, string>} names
 * @returns {{ text: string; operand: string; ref: number | null }}
 */
export function instruction(w, names) {
  const d = disassemble(w);
  const text = d.slice(0, d.lastIndexOf(" "));
  const a = lo(w);
  const kind = get(w, ENCODING.kind);
  // a transfer between registers still takes a memory cycle, but its address is no one's
  const touchesMemory = kind !== KIND.MEMORY || get(w, ENCODING.source) === 0 || get(w, ENCODING.destination) === 0;
  if (a === 0 && kind === KIND.MEMORY && !touchesMemory) return { text, operand: "", ref: null };
  if (isAddressed(w)) return { text, operand: symbolic(a, names), ref: a };
  // 'L takes the next word, and many special instructions ignore the field: leave out a zero
  if (a === 0 && (kind === KIND.NEXT || kind === KIND.OTHER)) return { text, operand: "", ref: null };
  return { text, operand: oct(a, 5), ref: null };
}

/**
 * The word after an 'L instruction, its operand: as an address when its upper half is clear and
 * a symbol is near, else in octal.
 * @param {number} w
 * @param {Map<number, string>} names
 * @returns {{ text: string; operand: string; ref: number | null }}
 */
export function operandWord(w, names) {
  const s = w < 0o100000 ? symbolic(w, names) : "";
  if (s && !/^[0-7]+$/.test(s)) return { text: "'L:", operand: s, ref: w };
  return { text: "'L:", operand: w < 0o100000 ? oct(w, 5) : oct(w), ref: null };
}

/**
 * Lines of a listing from an address.
 * @param {Core} core
 * @param {number} start
 * @param {number} count how many lines
 * @param {Mode} mode
 * @param {Map<number, string>} [names]
 * @returns {Line[]}
 */
export function listing(core, start, count, mode, names = namesByAddress(core)) {
  /** @type {Line[]} */
  const lines = [];
  let a = start & M15;
  for (let i = 0; i < count; i++) {
    const label = names.get(a) ?? "";
    const w = core.read(a);
    if (mode === "items") {
      // a word that is not an item (or one that would read outside core) is shown as "?"
      let len = 1;
      let text = "?";
      try {
        const d = decode(core, a);
        len = Math.max(1, Math.min(d.len, 8));
        text = itemText(d);
      } catch {
        // not an item
      }
      const words = [];
      for (let k = 0; k < len; k++) words.push(core.read((a + k) & M15));
      lines.push({ addr: a, len, label, words, text, operand: "", ref: null });
      a = (a + len) & M15;
      continue;
    }
    if (mode === "words") {
      lines.push({ addr: a, len: 1, label, words: [w], text: unpackText([w]).padEnd(5), operand: "", ref: null });
    } else if (get(core.read((a - 1) & M15), ENCODING.kind) === KIND.NEXT && !(i === 0 && label)) {
      // the operand of an 'L instruction before it: a constant, or an address
      lines.push({ addr: a, len: 1, label, words: [w], ...operandWord(w, names) });
    } else {
      lines.push({ addr: a, len: 1, label, words: [w], ...instruction(w, names) });
    }
    a = (a + 1) & M15;
  }
  return lines;
}

/**
 * An address typed by the reader: octal digits, a symbol, or either plus or minus an octal
 * offset (RVCD+3). Null if it names nothing.
 * @param {string} s
 * @param {Core} core
 * @returns {number | null}
 */
export function parseAddress(s, core) {
  const m = /^\s*([A-Z0-9.$%]+?)\s*(?:([+-])\s*([0-7]+))?\s*$/i.exec(s);
  if (!m) return null;
  const base = m[1].toUpperCase();
  let a = /^[0-7]+$/.test(base) ? parseInt(base, 8) : core.symbols.get(base);
  if (a === undefined || a > M15) return null;
  if (m[3]) a += (m[2] === "-" ? -1 : 1) * parseInt(m[3], 8);
  return a & M15;
}
