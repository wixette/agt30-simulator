// SPDX-License-Identifier: Apache-2.0
//
// The image format the AGT's display operator, DSPLY, interprets: image items in core memory,
// bit for bit as the manual gives them (DSPLY, Revision F, July 1969, pp. 12-26, and the code
// tables on pp. 39-41, read from the scan; research/data/agt30.json).
//
// An image is a two-word header (its name) followed by items, the last one a RET. An item's
// first word is its command:
//
//     bits 0-8 operation | 9-11 data type | 12-14 address mode | 15-29 address or argument
//
// The tables give each code as a value "!H", which ADEPT places in the upper half-word (bits
// 0-14): MOVE is 100!H, so its operation field is 1. The data type and address mode codes land
// in bits 9-11 and 12-14 the same way, which cross-checks the layout.
//
// This module holds the code tables, the core memory, a small builder that writes items into
// core (for the paper's pictures, whose data is generated: D6), and the decoder that reads
// them back (for listings, and for the interpreter in dsply.js). Gaps in the format are R3.

import { packText, unpackText } from "./amoscode.js";
import { hi, lo, M15, oct, toFrac, toAngle, word } from "./words.js";

/**
 * What an argument means (DSPLY p. 17): F fraction, I integer, L location, A angle, B binary.
 * @typedef {"F" | "I" | "L" | "A" | "B"} ArgKind
 */

/**
 * @typedef {object} OpDef
 * @property {string} name the mnemonic
 * @property {number} op the 9-bit operation field
 * @property {string} args the argument kinds in order, one letter each (see ArgKind)
 * @property {"element" | "transform" | "view" | "control"} cls
 * @property {string} [only] a model or option it needs, when not every AGT-30 has it
 */

/** @type {OpDef[]} */
export const OPS = [
  // element-generating (p. 39; pp. 17-21)
  { name: "MOVE", op: 0o1, args: "FFF", cls: "element" },
  { name: "2DTBL", op: 0o2, args: "L", cls: "element" },
  { name: "DRAW", op: 0o3, args: "FFF", cls: "element" },
  { name: "2DTF", op: 0o4, args: "L", cls: "element" },
  { name: "LABLR", op: 0o5, args: "L", cls: "element", only: "LCG1" },
  { name: "2DLST", op: 0o6, args: "L", cls: "element" },
  { name: "LABL", op: 0o7, args: "L", cls: "element", only: "LCG1" },
  { name: "2DTAB", op: 0o10, args: "L", cls: "element", only: "AGT/50" },
  { name: "2DTAF", op: 0o11, args: "L", cls: "element", only: "AGT/50" },
  { name: "2DINT", op: 0o12, args: "L", cls: "element", only: "AGT/50" },
  { name: "2DINF", op: 0o13, args: "L", cls: "element", only: "AGT/50" },
  { name: "3DTAB", op: 0o14, args: "L", cls: "element", only: "AGT/50" },
  { name: "3DTAF", op: 0o15, args: "L", cls: "element", only: "AGT/50" },
  { name: "2DROT", op: 0o16, args: "L", cls: "element", only: "AGT/50" },
  { name: "2DROF", op: 0o17, args: "L", cls: "element", only: "AGT/50" },
  // transform-specifying (p. 39; p. 22)
  { name: "SCL", op: 0o100, args: "F", cls: "transform" },
  { name: "ROTX", op: 0o101, args: "A", cls: "transform" },
  { name: "ROTY", op: 0o102, args: "A", cls: "transform" },
  { name: "ROTZ", op: 0o103, args: "A", cls: "transform" },
  { name: "RXYZ", op: 0o104, args: "AAA", cls: "transform" },
  { name: "DX", op: 0o105, args: "F", cls: "transform" },
  { name: "DY", op: 0o106, args: "F", cls: "transform" },
  { name: "DZ", op: 0o107, args: "F", cls: "transform" },
  { name: "DV", op: 0o110, args: "FFF", cls: "transform" },
  { name: "LDSCL", op: 0o200, args: "F", cls: "transform" },
  { name: "LDRX", op: 0o201, args: "A", cls: "transform" },
  { name: "LDRY", op: 0o202, args: "A", cls: "transform" },
  { name: "LDRZ", op: 0o203, args: "A", cls: "transform" },
  { name: "LDRV", op: 0o204, args: "AAA", cls: "transform" },
  { name: "LDX", op: 0o205, args: "F", cls: "transform" },
  { name: "LDY", op: 0o206, args: "F", cls: "transform" },
  { name: "LDZ", op: 0o207, args: "F", cls: "transform" },
  { name: "LDV", op: 0o210, args: "FFF", cls: "transform" },
  { name: "LDI", op: 0o212, args: "", cls: "transform" },
  // control (p. 39; pp. 23-26)
  { name: "NUL", op: 0o0, args: "", cls: "control" },
  { name: "SAVT", op: 0o300, args: "", cls: "control" },
  { name: "REST", op: 0o301, args: "", cls: "control" },
  { name: "RET", op: 0o302, args: "", cls: "control" },
  { name: "IMG", op: 0o303, args: "L", cls: "control" },
  { name: "LOOP", op: 0o304, args: "I", cls: "control" },
  { name: "ENDL", op: 0o305, args: "", cls: "control" },
  { name: "JMP", op: 0o306, args: "L", cls: "control" },
  { name: "JSR", op: 0o307, args: "L", cls: "control" },
  { name: "LONG", op: 0o315, args: "", cls: "control", only: "AGT/50" },
  { name: "SHORT", op: 0o316, args: "", cls: "control", only: "AGT/50" },
  { name: "LDMB", op: 0o500, args: "B", cls: "control" },
  { name: "ORMB", op: 0o501, args: "B", cls: "control" },
  { name: "ANDMB", op: 0o502, args: "B", cls: "control" },
  { name: "LDSN", op: 0o540, args: "B", cls: "control" },
  { name: "LDLS", op: 0o550, args: "B", cls: "control" },
  // viewing (p. 40; pp. 22-23)
  { name: "LDW", op: 0o310, args: "FFFF", cls: "view", only: "HWD1" },
  { name: "MVW", op: 0o311, args: "FF", cls: "view", only: "HWD1" },
  { name: "LWS", op: 0o312, args: "FF", cls: "view", only: "HWD1" },
  { name: "DEPTH", op: 0o313, args: "FFF", cls: "view" },
  { name: "LDPS", op: 0o314, args: "F", cls: "view" },
];

/** Conditional items carry a field in their operation code (p. 39): CJMP'C is 56C, WJMP'WW is 6WW. */
export const COND = { CJMP: 0o560, CJSR: 0o570 };
/** The condition codes C (p. 41): any of them selects the sense bit to test. */
export const CONDITION = { FLAG1: 4, FLAG2: 2, PEN: 1 };
/** The window bounds WW of WJMP and WJSR (p. 41), as the 6-bit field of the operation. */
export const WINDOW = { WBX1: 0o40, WBX2: 0o20, WBY1: 0o10, WBY2: 0o4, WBZ1: 0o2, WBZ2: 0o1 };

/** Data types, bits 9-11 (p. 41). */
export const DT = { IHW: 0, RHW: 1, IFW: 2, RFW: 3, IRL: 6, RRL: 7 };
/** Address modes, bits 12-14 (p. 41). */
export const AM = { IMED: 0, I: 1, DIR: 4, STR: 5 };

/** @type {Map<string, OpDef>} */
export const BY_NAME = new Map(OPS.map((o) => [o.name, o]));
/** @type {Map<number, OpDef>} */
const BY_CODE = new Map(OPS.map((o) => [o.op, o]));

/**
 * The definition of an operation field, including the conditional items.
 * @param {number} op 9 bits
 * @returns {{ def: OpDef; field: number } | null} field: the C or WW field of a conditional item
 */
export function opDef(op) {
  const exact = BY_CODE.get(op);
  if (exact) return { def: exact, field: 0 };
  if (op >> 3 === 0o56) return { def: { name: "CJMP", op: 0o560, args: "L", cls: "control" }, field: op & 7 };
  if (op >> 3 === 0o57) return { def: { name: "CJSR", op: 0o570, args: "L", cls: "control" }, field: op & 7 };
  if (op >> 6 === 6) return { def: { name: "WJMP", op: 0o600, args: "L", cls: "control", only: "HWD1" }, field: op & 0o77 };
  if (op >> 6 === 7) return { def: { name: "WJSR", op: 0o700, args: "L", cls: "control", only: "HWD1" }, field: op & 0o77 };
  return null;
}

/** The size of the AGT-30's core: 8K words standard, up to 32K (BRO69; NCSU). */
export const CORE_WORDS = 0o100000;

/**
 * Core memory: 30-bit words, and the symbols an assembler defined in it.
 */
export class Core {
  /** @param {number} [size] */
  constructor(size = CORE_WORDS) {
    /** @type {Uint32Array} */
    this.words = new Uint32Array(size);
    /** @type {Map<string, number>} */
    this.symbols = new Map();
    /** Incremented whenever a word changes, so views can tell. */
    this.version = 0;
  }

  /** @param {number} a @returns {number} */
  read(a) {
    return this.words[a & M15];
  }

  /** @param {number} a @param {number} w */
  write(a, w) {
    this.words[a & M15] = w;
    this.version++;
  }

  /**
   * An address by symbol.
   * @param {string} name
   * @returns {number}
   */
  addr(name) {
    const a = this.symbols.get(name);
    if (a === undefined) throw new Error(`no symbol ${name} in core`);
    return a;
  }
}

/**
 * An image's two-word header: its name in the AMOS internal 6-bit code (AMRMX p. 20), ten
 * characters at most, null-filled (DSPLY p. 12).
 * @param {string} name
 * @returns {[number, number]}
 */
export function nameWords(name) {
  const [a, b] = packText(name.slice(0, 10), 2);
  return [a, b];
}

/**
 * @param {number} w0
 * @param {number} w1
 * @returns {string}
 */
export const nameFromWords = (w0, w1) => unpackText([w0, w1]);

/**
 * A value for the builder: a raw half-word, or a symbol to be resolved when the builder ends.
 * @typedef {number | string} Arg
 */

/**
 * Writes images into core, item by item, as ADEPT's display image codes do. Arguments are raw
 * half-words; use the helpers f() and deg() for fractions and angles. Locations may be
 * symbols, resolved by end().
 */
export class ImageBuilder {
  /**
   * @param {Core} core
   * @param {number} origin first address to write
   */
  constructor(core, origin) {
    this.core = core;
    this.at = origin;
    /** @type {{ addr: number; sym: string; half: "lo" | "hi" }[]} */
    this.fixups = [];
  }

  /**
   * Defines a symbol at the current address.
   * @param {string} name
   * @returns {this}
   */
  label(name) {
    this.core.symbols.set(name, this.at);
    return this;
  }

  /**
   * Starts an image: its label and its two-word header.
   * @param {string} name
   * @returns {this}
   */
  image(name) {
    this.label(name);
    const [a, b] = nameWords(name);
    this.core.write(this.at++, a);
    this.core.write(this.at++, b);
    return this;
  }

  /**
   * @param {Arg} v
   * @param {"lo" | "hi"} half
   * @returns {number}
   */
  half(v, half) {
    if (typeof v === "number") return v & M15;
    this.fixups.push({ addr: this.at, sym: v, half });
    return 0;
  }

  /**
   * One word of data.
   * @param {number} w
   * @returns {this}
   */
  data(w) {
    this.core.write(this.at++, w);
    return this;
  }

  /**
   * An item with its arguments immediate (data type IHW, the assumed one): argument 1 in the
   * command word, arguments 2 and 3 in the next word's halves, and so on.
   * @param {string} name a mnemonic, or CJMP'FLAG1 / WJMP'WBX1 style for conditional items
   * @param {Arg[]} [args]
   * @returns {this}
   */
  item(name, args = []) {
    const op = encodeOp(name);
    const first = args.length ? this.half(args[0], "lo") : 0;
    this.core.write(this.at, word(op << 6, first));
    this.at++;
    for (let i = 1; i < args.length; i += 2) {
      const upper = this.half(args[i], "hi");
      const lower = i + 1 < args.length ? this.half(args[i + 1], "lo") : 0;
      this.core.write(this.at, word(upper, lower));
      this.at++;
    }
    return this;
  }

  /**
   * An item whose arguments are referenced: data type RHW, RFW or RRL, at a location given
   * with an address mode.
   * @param {string} name
   * @param {"RHW" | "RFW" | "RRL"} type
   * @param {Arg} where
   * @param {"IMED" | "DIR" | "I"} [mode]
   * @returns {this}
   */
  ref(name, type, where, mode = "IMED") {
    const op = encodeOp(name);
    const lower = this.half(where, "lo");
    this.core.write(this.at, word((op << 6) | (DT[type] << 3) | AM[mode], lower));
    this.at++;
    return this;
  }

  /**
   * An item with an immediate reference list (IRL): one word per argument, each with its own
   * address mode, so that a dial's value can be taken from wherever a program keeps it.
   * @param {string} name
   * @param {{ mode: "IMED" | "DIR" | "I"; at: Arg }[]} list
   * @returns {this}
   */
  refList(name, list) {
    const op = encodeOp(name);
    list.forEach((r, i) => {
      const upper = i === 0 ? (op << 6) | (DT.IRL << 3) | AM[r.mode] : AM[r.mode];
      const lower = this.half(r.at, "lo");
      this.core.write(this.at, word(upper, lower));
      this.at++;
    });
    return this;
  }

  /**
   * Resolves the symbols used before they were defined.
   * @returns {number} the next free address
   */
  end() {
    for (const f of this.fixups) {
      const v = this.core.addr(f.sym);
      const w = this.core.read(f.addr);
      this.core.write(f.addr, f.half === "lo" ? word(hi(w), v) : word(v, lo(w)));
    }
    this.fixups = [];
    return this.at;
  }
}

/**
 * The operation field of a mnemonic, including CJMP'C and WJMP'WW forms (C and WW may combine
 * several names with "+", as in CJMP'FLAG1+PEN).
 * @param {string} name
 * @returns {number}
 */
export function encodeOp(name) {
  const [base, field] = name.split("'");
  if (base === "CJMP" || base === "CJSR") {
    const c = (field ?? "").split("+").reduce((m, k) => m | (CONDITION[/** @type {keyof typeof CONDITION} */ (k)] ?? 0), 0);
    return COND[base] | c;
  }
  if (base === "WJMP" || base === "WJSR") {
    const ww = (field ?? "").split("+").reduce((m, k) => m | (WINDOW[/** @type {keyof typeof WINDOW} */ (k)] ?? 0), 0);
    return (base === "WJMP" ? 0o600 : 0o700) | ww;
  }
  const def = BY_NAME.get(base);
  if (!def) throw new Error(`unknown image item ${name}`);
  return def.op;
}

/** A fraction as a half-word: f(0.5) = 20000 octal. */
export const f = toFrac;
/** An angle in degrees as a half-word. */
export const deg = (/** @type {number} */ d) => toAngle((d * Math.PI) / 180);

/**
 * Finds the value an address mode points to (p. 15). Indirect chains are followed while a word
 * in the chain has address mode I in bits 12-14 (the manual does not say how a chain word marks
 * itself; this is ours, R3).
 * @param {Core} core
 * @param {number} mode
 * @param {number} address
 * @param {number} next the address of the following word, for the structured mode
 * @returns {{ value: number; loc: number | null; extra: number }} loc: where the value was read,
 *   or null for an immediate; extra: words the mode consumed after the command
 */
export function resolve(core, mode, address, next) {
  if (mode === AM.IMED) return { value: address & M15, loc: null, extra: 0 };
  if (mode === AM.DIR) return { value: lo(core.read(address)), loc: address, extra: 0 };
  if (mode === AM.I) {
    let a = address;
    for (let n = 0; n < 64; n++) {
      const w = core.read(a);
      if ((hi(w) & 7) !== AM.I) return { value: lo(w), loc: a, extra: 0 };
      a = lo(w);
    }
    throw new Error(`indirect chain too long at ${oct(address, 5)}`);
  }
  if (mode === AM.STR) {
    const base = resolve(core, hi(core.read(next)) & 7, lo(core.read(next)), next + 1);
    const loc = (base.value + address) & M15;
    return { value: lo(core.read(loc)), loc, extra: 1 };
  }
  throw new Error(`address mode ${mode} is not defined`);
}

/**
 * @typedef {object} Decoded
 * @property {number} addr
 * @property {number} len words the item occupies
 * @property {string} name
 * @property {OpDef | null} def
 * @property {number} field C or WW of a conditional item
 * @property {number} dt data type
 * @property {number} am address mode of the command word
 * @property {number[]} args the 15-bit arguments
 * @property {number[]} full the full words the arguments came from, where there was one (LDSN, LDLS)
 */

/**
 * Reads one item: its operation, and its arguments as its data type and address modes find them
 * (pp. 13-15).
 * @param {Core} core
 * @param {number} addr
 * @returns {Decoded}
 */
export function decode(core, addr) {
  const w0 = core.read(addr);
  const h = hi(w0);
  const op = h >> 6;
  const dt = (h >> 3) & 7;
  const am = h & 7;
  const found = opDef(op);
  const def = found ? found.def : null;
  const n = def ? def.args.length : 0;
  /** @type {number[]} */
  const args = [];
  /** @type {number[]} */
  const full = [];
  let len = 1;
  const name = def ? def.name : `?${oct(op, 3)}`;
  if (n === 0) return { addr, len: 1, name, def, field: found?.field ?? 0, dt, am, args, full };
  if (dt === DT.IHW) {
    args.push(lo(w0));
    full.push(w0);
    for (let i = 1; i < n; i += 2) {
      const w = core.read(addr + len++);
      args.push(hi(w));
      if (i + 1 < n) args.push(lo(w));
      full.push(w);
    }
  } else if (dt === DT.RHW) {
    const r = resolve(core, am, lo(w0), addr + 1);
    len += r.extra;
    const p = r.value;
    args.push(lo(core.read(p)));
    full.push(core.read(p));
    for (let i = 1, k = 1; i < n; i += 2, k++) {
      const w = core.read(p + k);
      args.push(hi(w));
      if (i + 1 < n) args.push(lo(w));
    }
  } else if (dt === DT.IFW) {
    for (let i = 0; i < n; i++) {
      const w = core.read(addr + i);
      args.push(lo(w));
      full.push(w);
    }
    len = n;
  } else if (dt === DT.RFW) {
    const r = resolve(core, am, lo(w0), addr + 1);
    len += r.extra;
    for (let i = 0; i < n; i++) {
      const w = core.read(r.value + i);
      args.push(lo(w));
      full.push(w);
    }
  } else if (dt === DT.IRL || dt === DT.RRL) {
    let p = addr;
    if (dt === DT.RRL) {
      const r = resolve(core, am, lo(w0), addr + 1);
      len += r.extra;
      p = r.value;
    } else len = n;
    for (let i = 0; i < n; i++) {
      const w = core.read(p + i);
      const r = resolve(core, hi(w) & 7, lo(w), p + i + 1);
      args.push(r.value);
      full.push(r.loc === null ? r.value : core.read(r.loc));
    }
  } else {
    throw new Error(`data type ${dt} at ${oct(addr, 5)} is not defined`);
  }
  return { addr, len, name, def, field: found?.field ?? 0, dt, am, args, full };
}

const DT_NAME = ["IHW", "RHW", "IFW", "RFW", "?4", "?5", "IRL", "RRL"];
const AM_NAME = ["", "I", "?2", "?3", "DIR", "STR", "?6", "?7"];

/**
 * One line of a listing: address, the item's words in octal, and the item as ADEPT would write it.
 * @param {Core} core
 * @param {Decoded} d
 * @returns {string}
 */
export function listItem(core, d) {
  const words = [];
  for (let i = 0; i < d.len; i++) words.push(oct(core.read(d.addr + i)));
  const mods = d.dt ? `'${DT_NAME[d.dt]}${d.am ? "'" + AM_NAME[d.am] : ""}` : "";
  const args = d.args.map((a) => oct(a, 5)).join(", ");
  return `${oct(d.addr, 5)}  ${words.join(" ").padEnd(22)}  ${d.name}${mods}${args ? " (" + args + ")" : ""}`;
}
