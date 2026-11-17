// SPDX-License-Identifier: Apache-2.0
//
// The AMOS resident monitor, AMRMX (AMRMX, June 1969; AMRMX71, May 1971), the part an operator
// types to.
//
// A control statement is "OPERATION (PARAMETER 1, ..., PARAMETER N)!" or "OPERATION!", ended by
// the exclamation mark (p. 1). Parameters are octal/symbolic expressions; a number ending in a
// period is decimal; "ABCDE" is a one-word string; an omitted parameter is -0 (pp. 3-5). For
// an operation the monitor does not know itself, it builds the standard calling sequence
// JPSR $TERM, the arguments, a zero word, and the return, and runs it (p. 3). "?" is typed for
// an improper statement, "*" for an improper argument (p. 18; AMRMX71 p. 11).
//
// The statements here are a subset: the display's (DSPLY, HALT, VIEW, CLOCK, CLKOF, from the
// DSPLY manual), the monitor's own (LIST, OPEN, DEFINE, DELETE, GOTO, STOP, MODE, BOUND,
// RESET, and from AMRMX71: V, CORE, DEC, OCT, MARK, RLSE), and ADEPT ("NAME")!, which
// assembles a source file from the simulator's store (on the real AGT the source came from tape
// or disk). When the monitor is loaded it asks the date (AMRMX71 p. 13), in the words AMRMX on
// the NCSU system pack uses (research/amrmx.md); the simulator answers it for the operator, so
// that nothing waits on a new reader. What else the monitor types back is ours: echoes, results,
// "?" and "*", with no prompt (R9).

import { assemble, evaluate } from "./adept.js";
import { packText, unpackText } from "./amoscode.js";
import { PEN_TABLE } from "./dsply.js";
import { hi, lo, M15, M30, oct, toOnes30 } from "./words.js";

/** @typedef {import("./agt.js").Agt30} Agt30 */

/** Where the monitor builds calling sequences (AMRMX p. 3), below its own area at 70000. */
export const CALL_AREA = 0o67700;
/** How long a statement's call runs before its program goes on in the foreground, us. */
const CALL_LIMIT_US = 20000;

/** The date prompt, as AMRMX on the NCSU system pack types it (research/amrmx.md). */
export const DATE_PROMPT = "MO/DA/YR = ";
/**
 * V!'s answer (AMRMX71 p. 11): STANDARD AMRMXn (REV. r, date). The revision and date are the
 * manual's; the version number is ours (R9).
 */
export const VERSION_LINE = "STANDARD AMRMX5 (REV. J, 5/6/71)";
/** The highest address the operator's programs may use: below the resident programs (R15). */
const CORE_TOP = 0o60000;

/** An expression the monitor could not evaluate: "*", not "?" (AMRMX71 p. 11). */
class ArgumentError extends Error {}

/** The DSPLY entry points a statement may name (DSPLY p. 8). */
export const ENTRY_POINTS = { SKIP: 0o77700, ALL: 0o77701, CUT: 0o77702, BUMP: 0o77703 };

export class Monitor {
  /** @param {Agt30} agt */
  constructor(agt) {
    this.agt = agt;
    /** The statement being typed. */
    this.line = "";
    /** The output format (MODE, p. 8): O octal, S symbolic, A characters, F all. Ours: O at start (R9). */
    this.mode = "O";
    /** BOUND (p. 8): the last first and last addresses. */
    this.bound = { first: 0o10000, last: 0o10020 };
    /** An OPEN cell (p. 9), or null. */
    /** @type {number | null} */
    this.open = null;
    /** Where the next assembly goes. */
    this.loadAt = 0o10000;
    /** @type {Map<string, string>} ADEPT source files, by name */
    this.files = new Map();
    /** @type {((text: string) => void) | null} called with each statement executed */
    this.onStatement = null;
    /** The radix of the numbers CORE types (DEC!, OCT!; AMRMX71 p. 7): octal at start. */
    this.decimal = false;
    /** @type {{ loadAt: number; symbols: Map<string, number> }[]} MARK's records (AMRMX71 p. 9) */
    this.marks = [];
    for (const [k, v] of Object.entries(ENTRY_POINTS)) agt.core.symbols.set(k, v);
    agt.core.symbols.set("PHT", PEN_TABLE);
  }

  /**
   * The monitor is loaded: it asks the date, and the operator answers it (AMRMX71 p. 13). Here
   * the answer is today's date, typed for the reader at once.
   * @param {Date} date
   */
  greet(date) {
    const two = (/** @type {number} */ n) => String(n).padStart(2, "0");
    const agt = this.agt;
    const was = agt.printAtOnce;
    agt.printAtOnce = true;
    this.type(`${DATE_PROMPT}${two(date.getMonth() + 1)}/${two(date.getDate())}/${two(date.getFullYear() % 100)}\r\n`);
    agt.printAtOnce = was;
  }

  /** @param {string} text */
  type(text) {
    this.agt.runBase = this.agt.now;
    this.agt.runCpu = this.agt.cpu.time;
    this.agt.print(text);
  }

  /**
   * One character typed on the Teletype's keyboard.
   * @param {string} ch
   */
  input(ch) {
    if (ch === "\b" || ch === "\x7f") {
      this.line = this.line.slice(0, -1);
      this.type("←");
      return;
    }
    if (ch === "\x15") {
      this.line = "";
      this.type(" ?\r\n");
      return;
    }
    const c = ch === "\n" ? "\r" : ch.toUpperCase();
    this.type(c === "\r" ? "\r\n" : c);
    if (this.open !== null && (c === "\r" || c === "," || c === ";")) {
      this.closeCell(c);
      return;
    }
    if (c === "\r") {
      if (this.line.trim() === "") this.line = "";
      else this.line += " ";
      return;
    }
    if (c === "?") {
      // "?" restarts the statement (p. 3)
      this.line = "";
      this.type("\r\n");
      return;
    }
    if (c === "!") {
      const s = this.line.trim();
      this.line = "";
      this.type("\r\n");
      this.statement(s);
      return;
    }
    this.line += c;
  }

  /**
   * Types a whole statement, as if from the keyboard.
   * @param {string} text
   */
  typeIn(text) {
    for (const ch of text) this.input(ch);
  }

  /**
   * Evaluates one parameter: an expression, a "string", or omitted (-0).
   * @param {string | undefined} p
   * @returns {number}
   */
  value(p) {
    if (p === undefined || p.trim() === "") return M30;
    const s = p.trim();
    const str = s.match(/^"(.*)"$/);
    if (str) return packText(str[1], 1)[0];
    let v;
    try {
      v = evaluate(s, (n) => this.agt.core.symbols.get(n), false).value;
    } catch (e) {
      throw new ArgumentError(/** @type {Error} */ (e).message);
    }
    return v >= 0 && v < 2 ** 30 ? v : toOnes30(v);
  }

  /**
   * Executes a control statement (without its "!").
   * @param {string} s
   */
  statement(s) {
    this.onStatement?.(s);
    const m = s.match(/^([A-Z][A-Z0-9.]*)\s*(?:\((.*)\))?$/);
    if (!m) {
      this.type("?\r\n");
      return;
    }
    const op = m[1];
    const params = m[2] === undefined ? [] : splitTop(m[2]);
    const agt = this.agt;
    const core = agt.core;
    const omitted = (/** @type {number} */ i) => params[i] === undefined || params[i].trim() === "";
    try {
      switch (op) {
        case "DSPLY": {
          const image = omitted(0) ? agt.image : lo(this.value(params[0]));
          if (image === null) throw new Error("no image");
          const rate = omitted(1) ? undefined : lo(this.value(params[1]));
          const errt = omitted(3) ? undefined : Object.entries(ENTRY_POINTS).find(([, v]) => v === lo(this.value(params[3])))?.[0];
          agt.start(image, rate, errt === "CUT" || errt === "BUMP" || errt === "ALL" ? errt : undefined);
          return;
        }
        case "HALT":
          agt.halt();
          return;
        case "VIEW": {
          const v = agt.dsply.view;
          agt.dsply.view = {
            front: omitted(0) ? v.front : lo(this.value(params[0])),
            back: omitted(1) ? v.back : lo(this.value(params[1])),
            dim: omitted(2) ? v.dim : lo(this.value(params[2])),
          };
          return;
        }
        case "CLOCK":
          agt.clockCode.push({ routine: lo(this.value(params[0])), exit: lo(this.value(params[1])) });
          return;
        case "CLKOF":
          agt.clockCode = [];
          return;
        case "MODE":
          this.mode = unpackText([this.value(params[0])]) || "S";
          return;
        case "BOUND": {
          const first = lo(this.value(params[0]));
          const last = lo(this.value(params[1]));
          // invalid bounds: "?" (AMRMX71 p. 11)
          if (first > last) throw new Error("");
          this.bound = { first, last };
          return;
        }
        case "V":
          this.type(`${VERSION_LINE}\r\n`);
          return;
        case "CORE": {
          // CORE! types the locations available; CORE(ARG)! evaluates ARG in the other radix (AMRMX71 p. 8)
          const n = params.length && !omitted(0) ? this.value(params[0]) : Math.max(0, CORE_TOP - this.loadAt);
          this.type(`${this.decimal ? String(n) : n.toString(8)}\r\n`);
          return;
        }
        case "DEC":
        case "OCT":
          this.decimal = op === "DEC";
          return;
        case "MARK":
          // the limits of program and symbol storage, recorded; its number typed (AMRMX71 p. 9)
          this.marks.push({ loadAt: this.loadAt, symbols: new Map(core.symbols) });
          this.type(`${this.marks.length}\r\n`);
          return;
        case "RLSE": {
          // back to MARK N's limits, or the latest MARK's (AMRMX71 p. 9)
          const n = omitted(0) ? this.marks.length : lo(this.value(params[0]));
          const m = this.marks[n - 1];
          if (!m) throw new Error("");
          this.loadAt = m.loadAt;
          core.symbols = new Map(m.symbols);
          this.marks.length = n - 1;
          return;
        }
        case "LIST": {
          if (!omitted(0)) this.mode = unpackText([this.value(params[0])]) || this.mode;
          const first = omitted(1) ? this.bound.first : lo(this.value(params[1]));
          const last = omitted(2) ? (omitted(1) ? this.bound.last : first) : lo(this.value(params[2]));
          this.bound = { first, last };
          for (let a = first; a <= last && a - first < 200; a++) this.type(this.cellLine(a) + "\r\n");
          return;
        }
        case "OPEN": {
          const a = lo(this.value(params[0]));
          if (!omitted(1)) this.mode = unpackText([this.value(params[1])]) || this.mode;
          this.openCell(a);
          return;
        }
        case "DEFINE":
          for (let i = 0; i + 1 < params.length; i += 2) {
            const name = params[i].trim();
            if (core.symbols.has(name)) this.type("?\r\n");
            else core.symbols.set(name, lo(this.value(params[i + 1])));
          }
          return;
        case "DELETE":
          for (const p of params) {
            // a symbol not found: "?" (AMRMX71 p. 11)
            const name = /^\s*".*"\s*$/.test(p) ? unpackText([this.value(p)]) : p.trim();
            if (!core.symbols.delete(name)) throw new Error("");
          }
          return;
        case "GOTO": {
          const a = lo(this.value(params[0]));
          const ret = 0o67777;
          core.write(ret, 0);
          agt.startProgram(a, ret, oct(a, 5));
          return;
        }
        case "STOP":
          agt.stopProgram();
          return;
        case "RESET":
          agt.reset();
          return;
        case "ADEPT": {
          const name = params.length ? unpackText([this.value(params[0])]) || params[0].replace(/"/g, "").trim() : "";
          const src = this.files.get(name);
          if (src === undefined) throw new Error(`no file ${name}`);
          const r = assemble(core, src, this.loadAt);
          for (const e of r.errors) this.type(`LINE ${e.line}: ${e.message.toUpperCase()}\r\n`);
          this.type(`${name} ${oct(r.start, 5)}-${oct(r.end - 1, 5)} ${r.errors.length ? r.errors.length + " ERRORS" : "OK"}\r\n`);
          this.loadAt = r.end;
          return;
        }
        default: {
          const sub = core.symbols.get(op);
          if (sub === undefined) {
            this.type("?\r\n");
            return;
          }
          // the standard calling sequence (p. 3), run in the foreground
          const args = params.map((p) => this.value(p));
          // a short routine returns within the call; a program that runs on (a game waiting for
          // the pen) goes on in the foreground, in step with simulated time
          const r = agt.cpu.call(sub, args, CALL_AREA, CALL_LIMIT_US);
          if (!r.done) {
            agt.startProgram(agt.cpu.LC, r.ret, op);
            return;
          }
          if (agt.cpu.stopped) this.type(`${agt.cpu.stopped}\r\n`);
        }
      }
    } catch (e) {
      const msg = /** @type {Error} */ (e).message.toUpperCase();
      // an argument that does not evaluate: "*"; anything else: "?" (AMRMX71 p. 11)
      const mark = e instanceof ArgumentError ? "*" : "?";
      this.type(msg ? `${mark} ${msg}\r\n` : `${mark}\r\n`);
    }
  }

  /**
   * One memory cell, as OPEN and LIST type it: its address in octal and a colon, then its
   * contents in the current MODE (AMRMX pp. 8-9). O: the two half-words in octal. S: the
   * location's name and a colon, if it has one, then each half as a symbol when one has that
   * value, else in octal. A: the five characters. Several letters give several formats.
   * @param {number} a
   * @returns {string}
   */
  cellLine(a) {
    const core = this.agt.core;
    const w = core.read(a);
    const parts = [];
    if (this.mode.includes("O") || this.mode.includes("F")) parts.push(`${oct(hi(w), 5)} ${oct(lo(w), 5)}`);
    if (this.mode.includes("S") || this.mode.includes("F")) {
      /** @param {number} v */
      const sym = (v) => [...core.symbols].find(([, x]) => x === v)?.[0] ?? oct(v, 5);
      const name = [...core.symbols].find(([, v]) => v === a)?.[0];
      parts.push(`${name ? `${name}: ` : ""}${sym(hi(w))} ${sym(lo(w))}`);
    }
    if (this.mode.includes("A") || this.mode.includes("F")) parts.push(unpackText([w]).padEnd(5));
    return `${oct(a, 5)}: ${parts.join("  ")}`;
  }


  /** @param {number} a */
  openCell(a) {
    this.open = a;
    this.type(`${this.cellLine(a)} `);
  }

  /**
   * Closes the open cell with the value typed, then opens the next (comma), the one it points
   * to (semicolon) or none (return) (p. 10).
   * @param {string} close
   */
  closeCell(close) {
    const a = /** @type {number} */ (this.open);
    const text = this.line.trim();
    this.line = "";
    this.open = null;
    try {
      if (text) this.agt.core.write(a, this.value(text));
    } catch {
      this.type("*\r\n");
    }
    if (close === ",") {
      this.type("\r\n");
      this.openCell((a + 1) & M15);
    } else if (close === ";") {
      this.type("\r\n");
      this.openCell(lo(this.agt.core.read(a)));
    }
  }
}

/**
 * Splits a parameter list at its top-level commas, keeping quoted strings whole.
 * @param {string} s
 * @returns {string[]}
 */
function splitTop(s) {
  const out = [];
  let depth = 0;
  let quote = false;
  let cur = "";
  for (const ch of s) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === "(") depth++;
    if (!quote && ch === ")") depth--;
    if (!quote && ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
