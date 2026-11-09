// SPDX-License-Identifier: Apache-2.0
//
// A subset of ADEPT, the Adage Extendable Program Translator (ADEPT, Revision G, July 1969),
// enough to write AGT programs as the manuals write them (R8).
//
// From the manual: nearly format-free statements ended by a semicolon or a carriage return;
// tags ending in a colon; comments running from a "[" to the end of the line; octal numbers unless
// DECIMAL is in force, and a number ending in a period is decimal; the operators + - & * / and
// the rotations !B (1 bit), !K (6 bits) and !H (15 bits: a value placed in the upper half);
// LOC, OCTAL, DECIMAL, TEXT, ENTRY, TITLE, TERMINATE, "=" and REPEAT/ENDR; the DPR-2's
// instruction mnemonics with their quote modifiers (MDAR'X'I); and, as in ADEPT version 5, the
// display image codes (DRAW, ROTX, IMG, RET ...).
//
// Ours (not in the manual): how a display item's arguments are written, "DRAW (Z, X, Y)" as the
// DSPLY manual names them; "'DIR" or "'I" after an argument of an IRL list for its address
// mode; fractions written with a point and digits after it (.5, -0.25); angles written in
// degrees with DEG (30DEG). Macros and action-operator definitions are not implemented.

import { packText } from "./amoscode.js";
import { assembleOp, isInstruction } from "./dpr2.js";
import { AM, BY_NAME, Core, DT, encodeOp } from "./image.js";
import { M15, toAngle, toFrac, toOnes15, toOnes30, word } from "./words.js";

/**
 * @typedef {object} Assembly
 * @property {number} start
 * @property {number} end the next free address
 * @property {{ line: number; message: string }[]} errors
 * @property {{ addr: number; words: number[]; line: number; text: string }[]} listing
 * @property {string[]} defined the symbols this assembly defined
 */

/**
 * One statement after splitting.
 * @typedef {{ line: number; text: string; tags: string[]; body: string }} Stmt
 */

const PSEUDO = new Set(["LOC", "OCTAL", "DECIMAL", "TEXT", "ENTRY", "TITLE", "TERMINATE", "REPEAT", "ENDR", "ASCII"]);

/**
 * Splits source text into statements: comments removed, ";" and line ends as terminators, tags
 * taken off the front, REPEAT n ... ENDR expanded.
 * @param {string} src
 * @returns {Stmt[]}
 */
export function statements(src) {
  /** @type {Stmt[]} */
  const out = [];
  src.split(/\r?\n|\r/).forEach((raw, i) => {
    let text = raw;
    // TEXT /.../ may contain [ and ; : protect it
    const m = text.match(/\bTEXT\s*(\S)(.*?)\1/);
    let protectedText = "";
    if (m) {
      protectedText = m[0];
      text = text.replace(m[0], "\u0001");
    }
    text = text.replace(/\[.*$/, "");
    for (let part of text.split(";")) {
      part = part.replace("\u0001", protectedText);
      const tags = [];
      let body = part.trim();
      for (;;) {
        const t = body.match(/^([A-Z][A-Z0-9.]*)\s*:(?!=)/i);
        if (!t) break;
        tags.push(t[1].toUpperCase());
        body = body.slice(t[0].length).trim();
      }
      if (body || tags.length) out.push({ line: i + 1, text: raw, tags, body });
    }
  });
  // REPEAT n ... ENDR (definite repeat)
  /** @type {Stmt[]} */
  const expanded = [];
  for (let i = 0; i < out.length; i++) {
    const r = out[i].body.match(/^REPEAT\s+(\d+)\.?$/i);
    if (!r) {
      expanded.push(out[i]);
      continue;
    }
    const end = out.findIndex((s, k) => k > i && /^ENDR$/i.test(s.body));
    if (end < 0) {
      expanded.push({ ...out[i], body: "?REPEAT without ENDR" });
      continue;
    }
    const body = out.slice(i + 1, end);
    const times = /\.$/.test(out[i].body) ? parseInt(r[1], 10) : parseInt(r[1], 8);
    const first = expanded.length;
    for (let k = 0; k < times; k++) expanded.push(...body.map((s) => ({ ...s, tags: k === 0 ? [...s.tags] : [] })));
    if (out[i].tags.length && expanded[first]) expanded[first].tags.unshift(...out[i].tags);
    i = end;
  }
  return expanded;
}

/**
 * Evaluates an expression to a signed number (ADEPT/PRM pp. 8-9 and our fraction and angle terms).
 * @param {string} expr
 * @param {(name: string) => number | undefined} lookup
 * @param {boolean} decimal the radix in force
 * @returns {{ value: number; kind: "int" | "frac" }}
 */
export function evaluate(expr, lookup, decimal) {
  const tokens = expr.toUpperCase().match(/!H|!K|!B|\d*\.\d+|\d+DEG|\d+\.?|[A-Z][A-Z0-9.]*|[-+&*/()]|\S/g) ?? [];
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
    if (/^[A-Z]/.test(t)) {
      const v = lookup(t);
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
      if (t === "!H") (i++, (v = v * 0o100000));
      else if (t === "!K") (i++, (v = v * 64));
      else if (t === "!B") (i++, (v = v * 2));
      else if (t === "*") (i++, (v *= term()));
      else if (t === "/") (i++, (v = Math.trunc(v / term())));
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
  const m = body.match(/^([A-Z0-9]+)((?:'[A-Z0-9+]+)*)\s*(.*)$/i);
  if (!m) return { mnemonic: "", mods: [], rest: body };
  return { mnemonic: m[1].toUpperCase(), mods: m[2].toUpperCase().split("'").filter(Boolean), rest: m[3].trim() };
}

/**
 * Assembles ADEPT source into core.
 * @param {Core} core
 * @param {string} src
 * @param {number} origin where to start (LOC may move it)
 * @returns {Assembly}
 */
export function assemble(core, src, origin) {
  const stmts = statements(src);
  /** @type {Map<string, number>} */
  const local = new Map();
  const lookup = (/** @type {string} */ n) => local.get(n) ?? core.symbols.get(n);
  /** @type {Assembly} */
  const result = { start: origin, end: origin, errors: [], listing: [], defined: [] };

  for (const pass of [1, 2]) {
    let at = origin;
    let decimal = false;
    for (const s of stmts) {
      for (const t of s.tags) {
        if (pass === 1) {
          if (local.has(t)) result.errors.push({ line: s.line, message: `${t} defined twice` });
          local.set(t, at);
        }
      }
      if (!s.body) continue;
      /** @type {number[]} */
      let words = [];
      try {
        const eq = s.body.match(/^([A-Z][A-Z0-9.]*)\s*=\s*(.+)$/i);
        const { mnemonic, mods, rest } = opField(s.body);
        if (s.body.startsWith("?")) throw new Error(s.body.slice(1));
        if (eq) {
          const name = eq[1].toUpperCase();
          const v = evaluate(eq[2], lookup, decimal).value;
          local.set(name, v);
          continue;
        } else if (PSEUDO.has(mnemonic)) {
          if (mnemonic === "LOC") {
            at = evaluate(rest, lookup, decimal).value & M15;
            if (pass === 1 && result.start === origin && result.listing.length === 0) result.start = at;
            continue;
          }
          if (mnemonic === "OCTAL" || mnemonic === "DECIMAL") {
            decimal = mnemonic === "DECIMAL";
            continue;
          }
          if (mnemonic === "TEXT" || mnemonic === "ASCII") {
            const d = rest[0];
            const end = rest.indexOf(d, 1);
            if (!d || end < 0) throw new Error("TEXT needs /delimiters/");
            words = packText(rest.slice(1, end), 2);
          } else if (mnemonic === "TERMINATE") break;
          else continue; // ENTRY, TITLE: every symbol is known to the monitor here
        } else if (isInstruction(mnemonic)) {
          /** @type {Record<string, boolean>} */
          const m = {};
          for (const k of mods) for (const c of k) m[c] = true;
          const a = rest ? evaluate(rest, (n) => lookup(n) ?? (pass === 1 ? 0 : undefined), decimal).value : 0;
          words = [assembleOp(mnemonic, a < 0 ? toOnes15(a) : a & M15, m)];
        } else if (BY_NAME.has(mnemonic) || /^(CJMP|CJSR|WJMP|WJSR)$/.test(mnemonic)) {
          words = imageItem(mnemonic, mods, rest, (e) => {
            const r = evaluate(e, (n) => lookup(n) ?? (pass === 1 ? 0 : undefined), decimal);
            return r.value < 0 ? toOnes15(r.value) : r.value & M15;
          });
        } else {
          const v = evaluate(s.body, (n) => lookup(n) ?? (pass === 1 ? 0 : undefined), decimal).value;
          // a positive number is the word's bits as written (7777777776 is -1); a negative one is complemented
          words = [v >= 0 && v < 2 ** 30 ? v : toOnes30(v)];
        }
      } catch (e) {
        if (pass === 2) result.errors.push({ line: s.line, message: /** @type {Error} */ (e).message });
        words = [0];
      }
      if (pass === 2) {
        words.forEach((w, k) => core.write(at + k, w));
        result.listing.push({ addr: at, words, line: s.line, text: s.text.trim() });
      }
      at += words.length;
    }
    result.end = at;
  }
  for (const [k, v] of local) {
    core.symbols.set(k, v);
    result.defined.push(k);
  }
  return result;
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
