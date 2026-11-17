// SPDX-License-Identifier: Apache-2.0
//
// ADEPT, the Adage Extendable Program Translator (ADEPT, Revision G, July 1969), as far as AGT
// programs and the NCSU sources need it (R8).
//
// From the manual: nearly format-free statements ended by a semicolon or a carriage return;
// tags ending in a colon; comments running from a "[" to the end of the line; octal numbers unless
// DECIMAL is in force, and a number ending in a period is decimal; the operators + - & * / //,
// space or tab between two terms as +, and the rotations !B (1 bit), !K (6 bits) and !H (15 bits:
// a value placed in the upper half); "." the current location; $NAME an external; LOC, OCTAL,
// DECIMAL, TEXT, STRING, ENTRY, TITLE, EXPUNGE, ABSOLUTE, TERMINATE and "="; string substitution:
// macros (MACRO, MACRO1, MACRO2 ... ENDM; "..." quotes a string, \ concatenates, % takes the next
// character literally), REPEAT ... ENDR, IREPEAT ... ENDI, and conditional translation (IFZERO,
// IFNEGATIVE, IFPASS1, IFSAME, ELSE, ENDC); TYPEOUT, TYPEOCT and TYPEDEC; LINKAGE, which the
// NCSU sources use as ENTRY; the DPR-2's instruction mnemonics with their quote modifiers
// (MDAR'X'I); and, as in ADEPT version 5, the display image codes (DRAW, ROTX, IMG, RET ...).
// The NCSU sources assemble with it to the words of their binaries (research/dpr2-encodings.md).
//
// Ours (not in the manual): how a display item's arguments are written, "DRAW (Z, X, Y)" as the
// DSPLY manual names them; "'DIR" or "'I" after an argument of an IRL list for its address
// mode; fractions written with a point and digits after it (.5, -0.25); angles written in
// degrees with DEG (30DEG). Not implemented: action operators (DEFINE), COMMON, TYPEIN, the #
// operators, relocatable output.

import { packText } from "./amoscode.js";
import { assembleOp, isInstruction } from "./dpr2.js";
import { AM, BY_NAME, Core, DT, encodeOp } from "./image.js";
import { M15, M30, toAngle, toFrac, toOnes15, word } from "./words.js";

/**
 * @typedef {object} Assembly
 * @property {number} start
 * @property {number} end the next free address
 * @property {{ line: number; message: string }[]} errors
 * @property {{ addr: number; words: number[]; line: number; text: string }[]} listing
 * @property {string[]} defined the symbols this assembly defined
 * @property {string[]} typed what TYPEOUT, TYPEOCT and TYPEDEC typed
 */

/** Statements that assemble to nothing here. */
/** LINKAGE, which the manual does not list, names entry points as ENTRY does (DPIIO on the tripp tape). */
const QUIET = new Set(["ENTRY", "LINKAGE", "TITLE", "EXPUNGE", "ABSOLUTE", "RELOCATE", "NOCARRET", "CARRET", "TYPEIN"]);
/** Operations followed by a string between two of a character the programmer chooses. */
const DELIMITED = /^(?:\s*[A-Z0-9.]+\s*:)*\s*(TEXT|STRING|ASCII|TYPEOUT)(\s*)$/i;
/** A symbol: letters, digits and points, at least one a letter. */
const SYMBOL = /^[A-Z0-9.]*[A-Z][A-Z0-9.]*$/;

/**
 * A text being read: the source, or a string substituted into it.
 * @typedef {{ text: string; pos: number; line: number; fixed: boolean }} Input
 */
/**
 * One statement: its text with comments removed, the source line it comes from, and where it
 * lies in its input.
 * @typedef {{ text: string; line: number; start: number; input: Input }} Statement
 */

/**
 * Reads statements from a stack of inputs: the source, and on top of it the strings that macro
 * calls, repeats and the like substitute.
 */
class Scanner {
  /** @param {string} text */
  constructor(text) {
    /** @type {Input[]} */
    this.stack = [{ text, pos: 0, line: 1, fixed: false }];
    this.substitutions = 0;
  }

  /**
   * Puts a string in front of what is left to read.
   * @param {string} text
   * @param {number} line the source line it stands for
   */
  push(text, line) {
    if (++this.substitutions > 100000) throw new Error("substitution does not end");
    if (this.stack.length > 64) throw new Error("nested more than 63 deep");
    this.stack.push({ text: `${text}\n`, pos: 0, line, fixed: true });
  }

  /** @returns {Statement | null} the next statement that is not empty */
  next() {
    for (;;) {
      const input = this.stack.at(-1);
      if (!input) return null;
      if (input.pos >= input.text.length) {
        this.stack.pop();
        continue;
      }
      const st = this.read(input);
      if (st.text.trim()) return st;
    }
  }

  /**
   * Reads one statement from an input.
   * @param {Input} input
   * @returns {Statement}
   */
  read(input) {
    const t = input.text;
    const start = input.pos;
    let i = start;
    let out = "";
    let quoted = false;
    let line = input.line;
    const newline = () => {
      if (!input.fixed) input.line++;
    };
    while (i < t.length) {
      const ch = t[i];
      if (!quoted && ch === "[") {
        while (i < t.length && t[i] !== "\n") i++;
        continue;
      }
      if (!quoted && (ch === ";" || ch === "\n")) {
        i++;
        if (ch === "\n") newline();
        break;
      }
      if (!out.trim() && /\S/.test(ch)) line = input.line;
      const d = quoted ? null : DELIMITED.exec(out);
      if (d && d[1] && /\S/.test(ch) && (d[2] || !/[A-Z0-9.]/i.test(ch))) {
        // TEXT /.../: the string runs to the next of its character, over lines and comments
        const end = t.indexOf(ch, i + 1);
        const stop = end < 0 ? t.length : end + 1;
        for (let k = i; k < stop; k++) if (t[k] === "\n") newline();
        out += t.slice(i, stop);
        i = stop;
        // the string ends the statement: what follows on the line is the next one ('.' ENDC)
        break;
      }
      if (ch === '"') quoted = !quoted;
      out += ch;
      i++;
    }
    input.pos = i;
    return { text: out, line, start, input };
  }

  /**
   * The raw text of a body, up to the symbol that closes it (MACRO ... ENDM, REPEAT ... ENDR),
   * counting nested openings; the closing symbol may end a line of the body
   * (MACRO ONE; "$ONE" ENDM). Reading goes on after it.
   * @param {Input} input the input the heading was read from
   * @param {RegExp} open
   * @param {RegExp} close
   * @returns {string}
   */
  body(input, open, close) {
    const from = input.pos;
    let depth = 0;
    while (input.pos < input.text.length) {
      const st = this.read(input);
      // the statement's text is its raw text up to any comment, so offsets carry over
      const re = /"[^"]*"?|[A-Z0-9.]+/gi;
      for (let m; (m = re.exec(st.text)); ) {
        const w = m[0].toUpperCase();
        if (open.test(w)) depth++;
        else if (close.test(w)) {
          if (depth === 0) {
            input.pos = st.start + m.index + m[0].length;
            return input.text.slice(from, st.start + m.index);
          }
          depth--;
        }
      }
    }
    throw new Error(`no ${close.source.replace(/[^A-Z|]/g, "").split("|").join(" or ")}`);
  }
}

/**
 * A statement's operation: its first word after any tags.
 * @param {string} text
 * @returns {string}
 */
function firstWord(text) {
  return (text.replace(/^(?:\s*[A-Z0-9.]+\s*:(?!=))*/i, "").trim().match(/^[A-Z0-9.]+/i)?.[0] ?? "").toUpperCase();
}

/**
 * Splits an argument list at top-level commas, keeping quoted strings and nested parentheses
 * whole and taking a character after % literally.
 * @param {string} s
 * @returns {string[]}
 */
function macroArgs(s) {
  /** @type {string[]} */
  const out = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "%" && i + 1 < s.length) {
      cur += s[++i];
      continue;
    }
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * The text inside a parenthesised list starting at s[i] = "(", and where it ends.
 * @param {string} s
 * @param {number} i
 * @returns {{ inner: string; end: number }}
 */
function parenthesised(s, i) {
  let depth = 0;
  let quoted = false;
  for (let k = i; k < s.length; k++) {
    if (s[k] === "%") {
      k++;
      continue;
    }
    if (s[k] === '"') quoted = !quoted;
    if (quoted) continue;
    if (s[k] === "(") depth++;
    if (s[k] === ")" && --depth === 0) return { inner: s.slice(i + 1, k), end: k + 1 };
  }
  throw new Error("unbalanced (");
}

/**
 * Replaces the symbols of a text that are names in a table, outside quoted strings.
 * @param {string} text
 * @param {(name: string, at: number) => string | undefined} replace
 * @returns {string}
 */
function eachSymbol(text, replace) {
  return text.replace(/"[^"]*"?|\$?[A-Z0-9.]+/gi, (m, at) => {
    if (m.startsWith('"') || m.startsWith("$") || !SYMBOL.test(m.toUpperCase())) return m;
    return replace(m.toUpperCase(), at) ?? m;
  });
}

/**
 * A macro: its dummy arguments and its body.
 * @typedef {{ params: string[]; body: string }} Macro
 */

/**
 * The first macro call in a statement, replaced by the macro's body with its arguments.
 * @param {string} text
 * @param {Map<string, Macro>} macros
 * @returns {string | null} the new text, or null if there is no call
 */
export function expandFirst(text, macros) {
  const re = /"[^"]*"?|\$?[A-Z0-9.]+/gi;
  for (let m; (m = re.exec(text)); ) {
    const name = m[0].toUpperCase();
    if (m[0].startsWith('"') || m[0].startsWith("$") || !macros.has(name)) continue;
    const macro = /** @type {Macro} */ (macros.get(name));
    let end = m.index + m[0].length;
    /** @type {string[]} */
    let args = [];
    if (macro.params.length) {
      const k = end + (text.slice(end).match(/^[ \t]*/)?.[0].length ?? 0);
      if (text[k] === "(") {
        const p = parenthesised(text, k);
        args = macroArgs(p.inner);
        end = p.end;
      } else {
        args = macroArgs(text.slice(end));
        end = text.length;
      }
    }
    const body = eachSymbol(macro.body, (sym) => {
      const n = macro.params.indexOf(sym);
      return n < 0 ? undefined : (args[n] ?? "");
    });
    return text.slice(0, m.index) + body + text.slice(end);
  }
  return null;
}

/**
 * Removes string quotes and concatenation marks outside a delimited string: "$ONE" is $ONE,
 * NAME\1 is NAME1.
 * @param {string} text
 * @returns {string}
 */
function literal(text) {
  return text.replace(/["\\]/g, "");
}

/**
 * Rotates a value's 30-bit word left (ADEPT p. 8: !B, !K, !H). For a value that fits, this is a
 * multiplication, in ones' complement too.
 * @param {number} v
 * @param {number} n
 * @returns {number}
 */
function rotate(v, n) {
  const w = v >= 0 ? v % 2 ** 30 : M30 - (-v % 2 ** 30);
  return (w * 2 ** n) % 2 ** 30 + Math.floor(w / 2 ** (30 - n));
}

/**
 * Evaluates an expression to a signed number (ADEPT/PRM pp. 8-9 and our fraction and angle terms).
 * "." is the location of the statement; $NAME an external, looked up as such. Terms side by side
 * add, as the NCSU sources write a word's two halves: 77737!H 77777.
 * @param {string} expr
 * @param {(name: string, external?: boolean) => number | undefined} lookup
 * @param {boolean} decimal the radix in force
 * @param {number} [here] the location of the statement
 * @returns {{ value: number; kind: "int" | "frac" }}
 */
export function evaluate(expr, lookup, decimal, here) {
  const tokens = expr.toUpperCase().match(/!H|!K|!B|\/\/|\d+DEG(?![A-Z0-9.])|\$?[0-9.]*[A-Z][A-Z0-9.]*|\d*\.\d+|\d+\.?|[-+&*/()]|\S/g) ?? [];
  let i = 0;
  let kind = /** @type {"int" | "frac"} */ ("int");
  /** @returns {number} */
  const term = () => {
    const t = tokens[i++];
    if (t === undefined) throw new Error("expression ends early");
    if (t === "-") return -term();
    if (t === "+") return term();
    if (t === "(") {
      const v = sum();
      if (tokens[i++] !== ")") throw new Error("missing )");
      return v;
    }
    if (/^\d*\.\d+$/.test(t)) {
      kind = "frac";
      return toFrac(Number(t)) & 0o40000 ? -(~toFrac(Number(t)) & M15) : toFrac(Number(t));
    }
    if (/^\d+DEG$/.test(t)) {
      const h = toAngle((parseInt(t, 10) * Math.PI) / 180);
      return h & 0o40000 ? -(~h & M15) : h;
    }
    if (/^\d+\.$/.test(t)) return parseInt(t, 10);
    if (/^\d+$/.test(t)) {
      if (!decimal && /[89]/.test(t)) throw new Error(`${t} is not octal`);
      return parseInt(t, decimal ? 10 : 8);
    }
    if (t === ".") {
      if (here === undefined) throw new Error("no location for .");
      return here;
    }
    if (/^\$?[0-9.]*[A-Z]/.test(t)) {
      const ext = t.startsWith("$");
      const v = lookup(ext ? t.slice(1) : t, ext);
      if (v === undefined) throw new Error(`${t} undefined`);
      return v;
    }
    throw new Error(`unexpected ${t}`);
  };
  /** @returns {number} */
  const product = () => {
    let v = term();
    for (;;) {
      const t = tokens[i];
      if (t === "!H") (i++, (v = rotate(v, 15)));
      else if (t === "!K") (i++, (v = rotate(v, 6)));
      else if (t === "!B") (i++, (v = rotate(v, 1)));
      else if (t === "*") (i++, (v *= term()));
      else if (t === "/") (i++, (v = Math.trunc(v / term())));
      else if (t === "//") (i++, (v %= term()));
      else return v;
    }
  };
  /** @returns {number} */
  const sum = () => {
    let v = product();
    for (;;) {
      const t = tokens[i];
      if (t === "+") (i++, (v += product()));
      else if (t === "-") (i++, (v -= product()));
      else if (t === "&") (i++, (v &= product()));
      else if (t !== undefined && t !== ")" && !/^(!H|!K|!B|\*|\/|\/\/)$/.test(t)) v += product();
      else return v;
    }
  };
  const value = sum();
  if (i < tokens.length) throw new Error(`unexpected ${tokens[i]}`);
  return { value, kind };
}

/**
 * Splits "A, (B, C), D" at top-level commas.
 * @param {string} s
 * @returns {string[]}
 */
function splitArgs(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Parses an operation field such as MDAR'X'I or CJMP'PEN or DRAW'RFW.
 * @param {string} body
 * @returns {{ mnemonic: string; mods: string[]; rest: string }}
 */
function opField(body) {
  const m = body.match(/^([A-Z0-9]+)((?:'[A-Z0-9+]+)*)\s*([\s\S]*)$/i);
  if (!m) return { mnemonic: "", mods: [], rest: body };
  return { mnemonic: m[1].toUpperCase(), mods: m[2].toUpperCase().split("'").filter(Boolean), rest: m[3].trim() };
}

/**
 * Assembles ADEPT source into core.
 * @param {Core} core
 * @param {string} src
 * @param {number} origin where to start (LOC may move it)
 * @param {{ externals?: "monitor" | "chain" }} [opts] how $NAME resolves: from the monitor's
 *   symbols (the default), or chained as a relocatable binary holds it: each use gives the
 *   address of the previous use of the same name, the first 0
 * @returns {Assembly}
 */
export function assemble(core, src, origin, opts = {}) {
  const lines = src.split(/\r?\n|\r/);
  /** @type {Map<string, number>} */
  const local = new Map();
  /** @type {Map<string, Macro>} */
  const macros = new Map();
  /** @type {Map<string, number>} the last use of each external, for a chain */
  const chain = new Map();
  /** The location of the statement being assembled. */
  let here = origin;
  /** @param {string} n @param {boolean} [ext] */
  const lookup = (n, ext) => {
    // an instruction's mnemonic as a term is its word: JPSR is 0002000000, JPSR!H 20
    if (!ext) return local.get(n) ?? core.symbols.get(n) ?? (isInstruction(n) ? assembleOp(n, 0) : undefined);
    if (opts.externals !== "chain") return core.symbols.get(n);
    const prev = chain.get(n) ?? 0;
    chain.set(n, here);
    return prev;
  };
  let pass = 1;
  const late = () => (/** @type {string} */ n, /** @type {boolean | undefined} */ ext) => lookup(n, ext) ?? (pass === 1 ? 0 : undefined);
  /** @type {Assembly} */
  const result = { start: origin, end: origin, errors: [], listing: [], defined: [], typed: [] };

  for (pass = 1; pass <= 2; pass++) {
    let at = origin;
    chain.clear();
    let decimal = false;
    const scan = new Scanner(lines.join("\n"));
    /** Conditional translation: whether each open IF... is being scanned. */
    /** @type {boolean[]} */
    const conds = [];
    const scanning = () => conds.every(Boolean);
    let done = false;

    /**
     * Handles one statement.
     * @param {string} text
     * @param {Statement} st
     */
    const statement = (text, st) => {
      const op = firstWord(text);
      // conditional translation is followed even while a string is being ignored
      if (/^IF(ZERO|NEGATIVE|PASS1|SAME)$/.test(op)) {
        if (!scanning()) return void conds.push(false);
        const rest = text.trim().slice(op.length).trim();
        if (op === "IFPASS1") conds.push(pass === 1);
        else if (op === "IFSAME") {
          /** @type {string[]} */
          const args = [];
          let r = rest;
          for (let k = 0; k < 2; k++) {
            r = r.trim();
            if (r.startsWith("(")) {
              const p = parenthesised(r, 0);
              args.push(p.inner.trim());
              r = r.slice(p.end);
            } else if (k === 0 && r) {
              args.push(r);
              r = "";
            } else {
              // IFSAME A; B; : the second argument is the next statement
              const nx = k === 1 && !r ? scan.next() : null;
              args.push((nx ? nx.text : r).trim());
            }
          }
          conds.push(args[0] === args[1]);
        } else {
          const v = evaluate(rest, late(), decimal, at).value;
          conds.push(op === "IFZERO" ? v === 0 : v < 0);
        }
        return;
      }
      if (op === "ELSE") {
        if (!conds.length) throw new Error("ELSE without IF");
        const outer = conds.slice(0, -1).every(Boolean);
        conds[conds.length - 1] = !conds[conds.length - 1];
        const rest = text.trim().slice(4);
        if (outer && conds.at(-1) && rest.trim()) statement(rest, st);
        return;
      }
      if (op === "ENDC") {
        if (!conds.length) throw new Error("ENDC without IF");
        conds.pop();
        return;
      }
      if (!scanning()) {
        // a body is skipped whole, so its own IF ... ENDC cannot confuse the count
        if (/^MACRO[12]?$/.test(op)) scan.body(st.input, /^MACRO[12]?$/, /^ENDM$/);
        return;
      }
      if (/^MACRO[12]?$/.test(op)) {
        const head = text.trim().slice(op.length).trim();
        const name = head.match(/^[A-Z0-9.]+/i)?.[0].toUpperCase();
        if (!name) throw new Error(`${op} needs a name`);
        const params = head.includes("(") ? macroArgs(parenthesised(head, head.indexOf("(")).inner).map((a) => a.toUpperCase()).filter(Boolean) : [];
        const body = scan.body(st.input, /^MACRO[12]?$/, /^ENDM$/);
        if (op === "MACRO" || (op === "MACRO1" && pass === 1) || (op === "MACRO2" && pass === 2)) macros.set(name, { params, body });
        return;
      }
      const delimited = /^(TEXT|STRING|ASCII|TYPEOUT)$/.test(op);
      if (!delimited) {
        const expanded = expandFirst(text, macros);
        if (expanded !== null) return scan.push(expanded, st.line);
      }
      // substitution is done: quotes and concatenation marks go (MD\BB is MDBR, "$ONE" is $ONE)
      let body = (delimited ? text : literal(text)).trim();
      /** @type {string[]} */
      const tags = [];
      for (;;) {
        const t = body.match(/^([A-Z0-9.]*[A-Z][A-Z0-9.]*)\s*:(?!=)/i);
        if (!t) break;
        tags.push(t[1].toUpperCase());
        body = body.slice(t[0].length).trim();
      }
      for (const t of tags) {
        if (pass === 1) {
          if (local.has(t)) result.errors.push({ line: st.line, message: `${t} defined twice` });
          local.set(t, at);
        }
      }
      if (!body) return;
      const { mnemonic, mods, rest } = opField(body);
      if (mnemonic === "REPEAT") {
        const inner = scan.body(st.input, /^I?REPEAT$/, /^ENDR$/);
        const n = evaluate(rest, lookup, decimal, at).value;
        if (n > 0) scan.push(inner.repeat(n), st.line);
        return;
      }
      if (mnemonic === "IREPEAT") {
        const m = rest.match(/^([A-Z0-9.]+)\s*,\s*(.*)$/is);
        if (!m) throw new Error("IREPEAT needs a dummy and a list");
        const dummy = m[1].toUpperCase();
        const list = m[2].trim().startsWith("(") ? parenthesised(m[2].trim(), 0).inner : m[2];
        const inner = scan.body(st.input, /^I?REPEAT$/, /^ENDI$/);
        const copies = macroArgs(list).map((a) => eachSymbol(inner, (sym) => (sym === dummy ? a : undefined)));
        if (copies.length) scan.push(copies.join(""), st.line);
        return;
      }
      if (mnemonic === "STOP") {
        if (scan.stack.length > 1) scan.stack.pop();
        return;
      }
      if (mnemonic === "TYPEOUT" || mnemonic === "TYPEOCT" || mnemonic === "TYPEDEC") {
        if (mnemonic === "TYPEOUT") {
          const d = rest.trimStart()[0];
          const r = rest.trimStart();
          result.typed.push(r.slice(1, r.indexOf(d, 1) < 0 ? undefined : r.indexOf(d, 1)));
        } else {
          const v = evaluate(rest, late(), decimal, at).value;
          result.typed.push(mnemonic === "TYPEOCT" ? (v < 0 ? "0" : v.toString(8)) : String(v));
        }
        return;
      }
      if (mnemonic === "ENDM" || mnemonic === "ENDR" || mnemonic === "ENDI") throw new Error(`${mnemonic} without its opening`);
      if (mnemonic === "DEFINE" || mnemonic === "COMMON") throw new Error(`${mnemonic} is not implemented`);
      const words = assembleStatement(body, mnemonic, mods, rest, st);
      if (words === null) return;
      if (pass === 2) {
        words.forEach((w, k) => core.write(at + k, w));
        result.listing.push({ addr: at, words, line: st.line, text: (lines[st.line - 1] ?? "").trim() });
      }
      at += words.length;
    };

    /**
     * The words of a statement that makes words, or null for one that sets something.
     * @param {string} body
     * @param {string} mnemonic
     * @param {string[]} mods
     * @param {string} rest
     * @param {Statement} st
     * @returns {number[] | null}
     */
    const assembleStatement = (body, mnemonic, mods, rest, st) => {
      here = at;
      try {
        const eq = body.match(/^([A-Z0-9.]*[A-Z][A-Z0-9.]*)\s*=\s*(.+)$/is);
        if (eq) {
          // undefined in pass 1, the symbol stays undefined (ADEPT p. 17); a definition makes no word
          try {
            local.set(eq[1].toUpperCase(), evaluate(eq[2], lookup, decimal, at).value);
          } catch (e) {
            if (pass === 2) throw e;
          }
          return null;
        }
        if (QUIET.has(mnemonic)) return null;
        if (mnemonic === "LOC") {
          at = evaluate(rest, lookup, decimal, at).value & M15;
          if (pass === 1 && result.start === origin && result.listing.length === 0) result.start = at;
          return null;
        }
        if (mnemonic === "OCTAL" || mnemonic === "DECIMAL") {
          decimal = mnemonic === "DECIMAL";
          return null;
        }
        if (mnemonic === "TERMINATE") {
          done = true;
          return null;
        }
        if (mnemonic === "TEXT" || mnemonic === "ASCII" || mnemonic === "STRING") {
          const r = rest.trimStart();
          const d = r[0];
          const end = r.indexOf(d, 1);
          if (!d || end < 0) throw new Error(`${mnemonic} needs /delimiters/`);
          const str = r.slice(1, end);
          if (mnemonic === "STRING") return [...packText(str), ...(str.length % 5 === 0 ? [0] : [])];
          if (mnemonic === "ASCII") return packAscii(str);
          return packText(str);
        }
        const operand = rest;
        // a mnemonic is a word, and MDAR-JUMP-2 an expression of words (ADEPT p. 8)
        if (isInstruction(mnemonic) && !/^[-+&*/!]/.test(operand.trim())) {
          /** @type {Record<string, boolean>} */
          const m = {};
          for (const k of mods) for (const c of k) m[c] = true;
          const a = operand.trim() ? evaluate(operand, late(), decimal, at).value : 0;
          return [assembleOp(mnemonic, a < 0 ? toOnes15(a) : a & M15, m)];
        }
        if (BY_NAME.has(mnemonic) || /^(CJMP|CJSR|WJMP|WJSR)$/.test(mnemonic)) {
          return imageItem(mnemonic, mods, operand, (e) => {
            const r = evaluate(e, late(), decimal, at);
            return r.value < 0 ? toOnes15(r.value) : r.value & M15;
          });
        }
        const v = evaluate(body, late(), decimal, at).value;
        // a positive number is the word's bits as written (7777777776 is -1); a negative one is
        // the ones' complement of its 30 bits: -(60400!H) is 1737777777
        return [v >= 0 ? v % 2 ** 30 : M30 - (-v % 2 ** 30)];
      } catch (e) {
        if (pass === 2) result.errors.push({ line: st.line, message: /** @type {Error} */ (e).message });
        return /^([A-Z0-9.]*[A-Z][A-Z0-9.]*)\s*=/i.test(body) ? null : [0];
      }
    };

    for (let st; !done && (st = scan.next()); ) {
      try {
        statement(st.text, st);
      } catch (e) {
        if (pass === 2) result.errors.push({ line: st.line, message: /** @type {Error} */ (e).message });
      }
    }
    if (conds.length && pass === 2) result.errors.push({ line: lines.length, message: "IF without ENDC" });
    result.end = at;
  }
  for (const [k, v] of local) {
    core.symbols.set(k, v);
    result.defined.push(k);
  }
  return result;
}

/** The ASCII operator's escapes after "@" (ADEPT pp. 6-7). */
const AT = {
  "'": 0o42, "+": 0o43, "@": 0o100, "(": 0o74, ")": 0o76, "]": 0o133, V: 0o136, "-": 0o137, "/": 0o134,
  R: 0o35, L: 0o34, B: 0o37, D: 0o36, E: 0o23, S: 0o22, I: 0o10, C: 0o15, F: 0o12, X: 0o11, Y: 0o13, N: 0,
};

/**
 * A string for the LCG1 character generator, as ASCII assembles it (ADEPT pp. 6-7): four 7-bit
 * characters to a word, in bits 0-6, 7-13, 15-21 and 22-28; bit 14 marks the last word; NUL
 * fills it. "@" and three octal digits give any code, "@" and a letter the codes listed in AT.
 * @param {string} str
 * @returns {number[]}
 */
export function packAscii(str) {
  /** @type {number[]} */
  const codes = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch !== "@") {
      codes.push(ch === "\n" ? 0o15 : ch.toUpperCase().charCodeAt(0) & 0o177);
      continue;
    }
    const oct = str.slice(i + 1, i + 4);
    if (/^[0-7]{3}$/.test(oct)) {
      codes.push(parseInt(oct, 8) & 0o177);
      i += 3;
    } else {
      const c = AT[/** @type {keyof typeof AT} */ (str[i + 1])];
      if (c !== undefined) codes.push(c);
      i += 1;
    }
  }
  /** @type {number[]} */
  const words = [];
  for (let i = 0; i < codes.length || i === 0; i += 4) {
    const [a = 0, b = 0, c = 0, d = 0] = codes.slice(i, i + 4);
    const last = i + 4 >= codes.length;
    words.push(a * 2 ** 23 + b * 2 ** 16 + (last ? 2 ** 15 : 0) + c * 2 ** 8 + d * 2);
  }
  return words;
}

/**
 * The words of one display item.
 * @param {string} mnemonic
 * @param {string[]} mods data type, or a condition / window field
 * @param {string} rest the argument list or reference
 * @param {(e: string) => number} value evaluates an expression to a half-word
 * @returns {number[]}
 */
function imageItem(mnemonic, mods, rest, value) {
  const dtName = mods.find((m) => m in DT);
  const field = mods.filter((m) => !(m in DT));
  const name = field.length ? `${mnemonic}'${field.join("+")}` : mnemonic;
  const op = encodeOp(name);
  const def = BY_NAME.get(mnemonic);
  const n = def ? def.args.length : 1;
  const inner = rest.replace(/^\((.*)\)$/, "$1");
  const args = rest ? splitArgs(inner) : [];
  const dt = DT[/** @type {keyof typeof DT} */ (dtName ?? "IHW")];
  if (dt === DT.IHW) {
    if (args.length !== n) throw new Error(`${mnemonic} takes ${n} argument${n === 1 ? "" : "s"}`);
    const h = args.map(value);
    const w = [word(op << 6, h[0] ?? 0)];
    for (let i = 1; i < n; i += 2) w.push(word(h[i], i + 1 < n ? h[i + 1] : 0));
    return w;
  }
  if (dt === DT.IRL) {
    if (args.length !== n) throw new Error(`${mnemonic} takes ${n} arguments`);
    return args.map((a, i) => {
      const [expr, ...am] = a.split("'");
      const mode = AM[/** @type {keyof typeof AM} */ ((am[0] ?? "IMED").toUpperCase())] ?? 0;
      return word(i === 0 ? (op << 6) | (DT.IRL << 3) | mode : mode, value(expr));
    });
  }
  if (dt === DT.IFW) {
    const h = args.map(value);
    return h.map((v, i) => word(i === 0 ? (op << 6) | (DT.IFW << 3) : 0, v));
  }
  // RHW, RFW, RRL: one word, a reference with an address mode
  const [expr, ...am] = rest.split("'");
  const mode = AM[/** @type {keyof typeof AM} */ ((am[0] ?? "IMED").toUpperCase())] ?? 0;
  return [word((op << 6) | (dt << 3) | mode, value(expr))];
}
