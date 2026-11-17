// SPDX-License-Identifier: Apache-2.0
//
// Pairs ADEPT source statements with the words the assembler made of them, for the routines on
// a tape that survive as source, binary and symbols (research/dpr2-encodings.md).
//
//     node tools/dpr2-pairs.mjs TAPE                (the routines, the forms and the outliers)
//     node tools/dpr2-pairs.mjs TAPE --json OUT     (also every pair, as JSON)
//
// A routine is three files in a row: its source (ATEXT), its binary (RELOC) and its symbols
// (RLSYM). The symbol table gives each label's address, and each label fixes where its statement
// sits; from there the routine is walked statement by statement until one whose size is not
// certain (a string, a macro, a REPEAT). A pair is checked when its operand can be evaluated and
// is not external: it matches when the value equals the word's address half. A pair with nothing
// to check is trusted when the pairs on either side, up to the first checked one, all match.
// Each trusted instruction is then checked against the layout of that note, and the misfits are
// listed.
//
// The tape is read with tools/amos-tape.mjs; none is kept in this repository.

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { fileName, readTape, text } from "./amos-tape.mjs";

const M15 = 0o77777;
const ONES = 0o7777777777;
/** Statements that assemble to nothing. */
const ZERO = new Set(["EXPUNGE", "TITLE", "ENTRY", "TERMINATE", "ABSOLUTE", "ENDM", "ENDC", "ENDI", "ENDR",
  "IFPASS1", "IFSAME", "IFZERO", "IFDIFF", "ELSE", "TYPEOUT", "TYPEIN", "LINKAGE"]);
/** Statements whose size is not known here. */
const UNCERTAIN = new Set(["STRING", "TEXT", "ASCII", "REPEAT", "IREPEAT", "LOC", "MACRO"]);

/**
 * @typedef {object} Statement
 * @property {number} line
 * @property {string | null} label
 * @property {string} op "" for a label alone, "=" for a definition
 * @property {string} operand
 * @property {string} raw
 */

/**
 * @typedef {object} Pair
 * @property {string} routine
 * @property {number} file
 * @property {number} line
 * @property {number} addr
 * @property {string} op
 * @property {string} operand
 * @property {number} word
 * @property {boolean | null} match null when there is nothing to check
 * @property {string} src
 */

/**
 * A binary's words, from address 0, and the program's length.
 * @param {number[][]} records
 * @param {number} entries
 * @returns {{ words: number[], length: number | null }}
 */
export function codeWords(records, entries) {
  /** @type {number[]} */
  const words = [];
  records.forEach((r, k) => {
    let body = r.at(-1) === ONES ? r.slice(3, -1) : r.slice(3);
    if (k === 0) body = body.slice(2 * entries);
    words.push(...body);
  });
  let j = words.length;
  while (j > 0 && Math.floor(words[j - 1] / 2 ** 24) === 0o60) j--;
  return { words, length: j < words.length ? words[j] & M15 : null };
}

/**
 * A symbol table: each label's address.
 * @param {number[][]} records
 * @param {(w: number) => string} name
 * @returns {Map<string, number>}
 */
export function symbols(records, name) {
  const out = new Map();
  for (const r of records) for (let i = 1; i < r.length - 2; i += 3) out.set(name(r[i + 1]), r[i] & M15);
  return out;
}

/**
 * The statements of a source, and the names of its macros.
 * @param {string} source
 * @returns {{ statements: Statement[], macros: Set<string> }}
 */
export function statements(source) {
  /** @type {Statement[]} */
  const out = [];
  const macros = new Set();
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = i + 1;
    i++;
    if (raw.startsWith("TERMINATE")) break;
    // A string may hold "[" and run over lines: skip to its closing delimiter.
    const m = /^([^\t[]*?:)?\t*\s*(STRING|TEXT|ASCII)\s*(.)/.exec(raw);
    if (m) {
      let rest = raw.slice(m[0].length);
      while (!rest.includes(m[3]) && i < lines.length) rest = lines[i++];
      out.push({ line, label: (m[1] ?? "").replace(/:$/, "").trim() || null, op: m[2], operand: "", raw });
      continue;
    }
    const code = raw.split("[")[0];
    if (!code.trim()) continue;
    if (code.trimStart().startsWith("MACRO")) {
      macros.add(code.trim().split(/\s+/)[1] ?? "?");
      if (!code.includes("ENDM")) while (i < lines.length && !lines[i++].split("[")[0].includes("ENDM"));
      continue;
    }
    const fields = code.split("\t");
    /** @type {string | null} */
    let label = null;
    if (fields[0].includes(":")) {
      label = fields[0].split(":")[0].trim();
      fields[0] = fields[0].slice(fields[0].indexOf(":") + 1);
    }
    for (let st of fields.join("\t").split(";")) {
      st = st.replace(/^[\t ]+|[\t ]+$/g, "");
      if (!st) {
        if (label) out.push({ line, label, op: "", operand: "", raw });
        label = null;
        continue;
      }
      if (/^[A-Z0-9.]+\s*=/.test(st)) {
        out.push({ line, label, op: "=", operand: st, raw });
      } else {
        const sp = st.search(/[\t ]/);
        out.push({ line, label, op: sp < 0 ? st : st.slice(0, sp), operand: sp < 0 ? "" : st.slice(sp).trim(), raw });
      }
      label = null;
    }
  }
  return { statements: out, macros };
}

/**
 * A statement's size in words: null when it is not known here.
 * @param {string} op
 * @param {Set<string>} macros
 * @returns {number | null}
 */
export function size(op, macros) {
  if (op === "") return null;
  if (op === "=") return 0;
  const base = op.split("'")[0];
  if (ZERO.has(base)) return 0;
  if (UNCERTAIN.has(base) || base.startsWith("IREPEAT")) return null;
  if (macros.has(base) || macros.has(base.split("(")[0])) return null;
  return 1;
}

/**
 * An operand's value, as 15 bits: null when it cannot be worked out here. Externals ($X) are 0,
 * as in the binary; a negative value is the ones' complement.
 * @param {string} expr
 * @param {Map<string, number>} syms
 * @param {number} here
 * @param {Set<string>} macros
 * @returns {number | null}
 */
export function evaluate(expr, syms, here, macros) {
  expr = expr.trim();
  if (!expr || macros.has(expr)) return 0;
  const tokens = expr.match(/\$?[A-Z0-9][A-Z0-9.]*!H|\$?[A-Z0-9][A-Z0-9.]*|\.|[-+]|\S/g) ?? [];
  let val = 0;
  let sign = 1;
  for (const t of tokens) {
    if (t === "+" || t === "-") {
      sign = t === "+" ? 1 : -1;
      continue;
    }
    if (t.endsWith("!H")) return null;
    let v;
    if (t === ".") v = here;
    else if (t.startsWith("$")) v = 0;
    else if (/^[0-7]+$/.test(t)) v = parseInt(t, 8);
    else if (/^[0-9]+\.$/.test(t)) v = parseInt(t, 10);
    else if (syms.has(t)) v = /** @type {number} */ (syms.get(t));
    else return null;
    val += sign * v;
  }
  return val >= 0 ? val & M15 : (M15 + val) & M15;
}

/**
 * Pairs one routine.
 * @param {{ name: string, file: number, source: string, binary: number[][], symbols: Map<string, number> }} r
 * @returns {{ pairs: Pair[], words: number, length: number | null }}
 */
export function pairRoutine(r) {
  const { statements: sts, macros } = statements(r.source);
  const entries = sts.reduce((n, s) => n + (s.op === "ENTRY" ? s.operand.split(",").length : 0), 0);
  const { words, length } = codeWords(r.binary, entries);
  const defs = new Map(r.symbols);
  for (const s of sts) {
    if (s.op !== "=") continue;
    const [k, v] = [s.operand.slice(0, s.operand.indexOf("=")), s.operand.slice(s.operand.indexOf("=") + 1)];
    const ev = evaluate(v.trim().split(/\s+/)[0] ?? "", defs, 0, macros);
    if (ev !== null) defs.set(k.trim(), ev);
  }
  /** @type {Pair[]} */
  const pairs = [];
  let here = 0;
  let sure = true;
  for (const s of sts) {
    if (s.label && r.symbols.has(s.label)) {
      here = /** @type {number} */ (r.symbols.get(s.label));
      sure = true;
    }
    const n = size(s.op, macros);
    if (n === null) {
      if (s.op !== "") sure = false;
      continue;
    }
    if (n === 0) continue;
    if (sure && here < words.length && (length === null || here < length)) {
      const w = words[here];
      const operand = s.operand.trim();
      const ev = evaluate(operand, defs, here, macros);
      const weak = !operand || operand.startsWith("$") || macros.has(operand.split(/\s+/)[0]);
      pairs.push({ routine: r.name, file: r.file, line: s.line, addr: here, op: s.op, operand: s.operand, word: w,
        match: ev === null || weak ? null : ev === (w & M15), src: s.raw.trim() });
    }
    here++;
  }
  return { pairs, words: words.length, length };
}

/**
 * The pairs to trust: those that match, and those with nothing to check that lie in a run
 * bounded on both sides by matches.
 * @param {Pair[]} pairs
 * @returns {Pair[]}
 */
export function trusted(pairs) {
  const at = new Map(pairs.map((p) => [`${p.file}/${p.addr}`, p]));
  /** @param {Pair} p @param {number} d */
  const bounded = (p, d) => {
    for (let a = p.addr + d; ; a += d) {
      const q = at.get(`${p.file}/${a}`);
      if (!q || q.match === false) return false;
      if (q.match === true) return true;
    }
  };
  return pairs.filter((p) => p.match === true || (p.match === null && bounded(p, -1) && bounded(p, 1)));
}

/** Destinations (bits 2-5) and sources (bits 6-8), octal as ADEPT numbers them. */
/** @type {Record<string, number>} */
export const DESTS = { MD: 0, AR: 1, BR: 2, IC: 3, IR: 4, AS: 0o15, AE: 0o16, XO: 0o17 };
/** @type {Record<string, number>} */
export const SOURCES = { MD: 0, AR: 1, BR: 2, IC: 3, S4: 4, S5: 5 };
/**
 * The instructions that are not transfers, as the tripp tape shows them.
 * @type {Record<string, number>}
 */
export const OTHERS = { NOOP: 0, JPSR: 0o20, JUMP: 0o40, JSAN: 0o60, JPAN: 0o100, JPLS: 0o140, PULSE: 0o200,
  SKUA: 0o220, SKLA: 0o240, UPRI: 0o340, FPRI: 0o360, ANAR: 0o1260, ANIR: 0o4260, LSAR: 0o1300, LSIR: 0o4300,
  PINT: 0o560, LSAS: 0o15300, LSAE: 0o16300, ARRS: 0o17440, ARLS: 0o17500, NORM: 0o17520, ERAR: 0o17540, MPYI: 0o15440,
  DIVI: 0o16440 };
/**
 * Modifiers: [shift, value] within the upper half (bit 14 is shift 0).
 * @type {Record<string, [number, number]>}
 */
const MODS = { B: [4, 1], K: [4, 2], H: [4, 3], O: [2, 1], A: [2, 2], N: [2, 3], X: [1, 1], I: [0, 1] };

/**
 * The upper half the layout of research/dpr2-encodings.md gives an operation, or null when it
 * is not an instruction known there (a data word, a macro).
 * @param {string} op
 * @returns {number | null}
 */
export function encode(op) {
  const [base, ...mods] = op.split("'");
  /** @type {Record<string, number>} */
  const fields = {};
  let v;
  /** @param {string} r @returns {number | undefined} */
  const dest = (r) => (/^[0-7]{2}$/.test(r) ? parseInt(r, 8) : DESTS[r]);
  const src = SOURCES[base.slice(0, 2)];
  const dst = base.length === 4 ? dest(base.slice(2)) : undefined;
  if (base in OTHERS) v = OTHERS[base];
  else if (src !== undefined && dst !== undefined) {
    const kind = mods.includes("F") ? 3 : mods.includes("L") ? 2 : 1;
    v = (kind << 13) | (dst << 9) | (src << 6);
  } else return null;
  for (const m of mods) {
    if (m === "F" || m === "L") {
      if (base in OTHERS) return null;
      continue;
    }
    const mod = MODS[m];
    if (!mod || fields[mod[0]] !== undefined) return null;
    fields[mod[0]] = mod[1];
    v |= mod[1] << mod[0];
  }
  return v;
}

/** @param {number} v @param {number} w @returns {string} */
const oct = (v, w) => v.toString(8).padStart(w, "0");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: "string" } } });
  if (positionals.length !== 1) {
    console.error("usage: node tools/dpr2-pairs.mjs TAPE [--json OUT]");
    process.exit(2);
  }
  const files = readTape(readFileSync(positionals[0]));
  /** @type {Pair[]} */
  const all = [];
  for (const f of files) {
    if (f.type !== "ATEXT") continue;
    const find = (/** @type {number} */ d, /** @type {string} */ type) =>
      files.find((g) => g.file === f.file + d && g.type === type && g.name === f.name);
    const rel = find(1, "RELOC");
    if (!rel) continue;
    const sym = find(2, "RLSYM");
    const r = pairRoutine({ name: f.name, file: f.file, source: text(f.words), binary: rel.records,
      symbols: sym ? symbols(sym.records, fileName) : new Map() });
    const ok = r.pairs.filter((p) => p.match === true).length;
    const bad = r.pairs.filter((p) => p.match === false).length;
    console.log(`${oct(f.file, 3)} ${f.name.padEnd(6)} words ${String(r.words).padStart(4)}  length ${String(r.length).padStart(4)}  operands: ${String(ok).padStart(4)} match ${String(bad).padStart(3)} not`);
    all.push(...r.pairs);
  }
  const instr = trusted(all).filter((p) => encode(p.op) !== null);
  const upper = (/** @type {Pair} */ p) => Math.floor(p.word / 2 ** 15);
  const isTransfer = (/** @type {Pair} */ p) => !(p.op.split("'")[0] in OTHERS);
  const misfits = instr.filter((p) => encode(p.op) !== upper(p));
  /** @type {Map<string, number>} */
  const forms = new Map();
  for (const p of instr) {
    if (misfits.includes(p)) continue;
    const [base, ...mods] = p.op.split("'");
    const k = [base, ...mods.sort()].join("'");
    forms.set(k, (forms.get(k) ?? 0) + 1);
  }
  const count = (/** @type {Pair[]} */ ps, /** @type {(p: Pair) => boolean} */ f) => ps.filter(f).length;
  const routines = new Set(instr.map((p) => p.routine)).size;
  console.log(`\n${all.length} pairs; ${instr.length} trusted instructions from ${routines} routines, in ${forms.size} forms`);
  console.log(`transfers: ${count(instr, isTransfer) - count(misfits, isTransfer)} of ${count(instr, isTransfer)} fit the layout`);
  console.log(`others:    ${count(instr, (p) => !isTransfer(p)) - count(misfits, (p) => !isTransfer(p))} of ${count(instr, (p) => !isTransfer(p))} fit`);
  console.log("\nforms that fit, and how many:");
  for (const k of [...forms.keys()].sort()) console.log(`  ${k.padEnd(14)} ${oct(/** @type {number} */ (encode(k)), 5)} ×${forms.get(k)}`);
  console.log("\nmisfits (address, word, expected upper half, source):");
  for (const p of misfits) {
    console.log(`  ${p.routine.padEnd(6)} ${oct(p.addr, 4)} ${oct(p.word, 10)} ${oct(/** @type {number} */ (encode(p.op)), 5)} ${p.src}`);
  }
  if (values.json) writeFileSync(values.json, JSON.stringify(all));
}
