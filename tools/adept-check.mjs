// SPDX-License-Identifier: Apache-2.0
//
// Assembles every routine on a tape that survives as source and binary with our ADEPT
// (js/sim/adept.js), and checks the words against the binary's (research/dpr2-encodings.md).
//
//     node tools/adept-check.mjs TAPE            (one line a routine, and a total)
//     node tools/adept-check.mjs TAPE NAME [N]   (also that routine's first N differences)
//
// A routine is assembled from 0 with its externals chained, as a relocatable binary holds them
// (each use gives the address of the previous use of the same name). Our words, in the order the
// assembler emits them, are aligned with the binary's items (a longest common subsequence): a
// routine passes when every word of ours is among them in order. The items left over are the
// loader's (entry and external pairs, set-location items, the trailer), counted by kind.
//
// The tape is read with tools/amos-tape.mjs; none is kept in this repository.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assemble } from "../js/sim/adept.js";
import { disassemble } from "../js/sim/dpr2.js";
import { Core } from "../js/sim/image.js";
import { readTape, text } from "./amos-tape.mjs";

const ONES = 0o7777777777;

/**
 * A binary's items: each record less its name, the all-ones word, the flags word and the
 * all-ones word that ends it.
 * @param {number[][]} records
 * @returns {number[]}
 */
export function items(records) {
  return records.flatMap((r) => r.slice(3, r.at(-1) === ONES ? -1 : undefined));
}

/**
 * Aligns two sequences: which of each are left out of a longest common subsequence.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {{ common: number; onlyA: number[]; onlyB: number[] }} indexes
 */
export function align(a, b) {
  const A = a.length;
  const B = b.length;
  const dp = Array.from({ length: A + 1 }, () => new Uint32Array(B + 1));
  for (let i = A - 1; i >= 0; i--) {
    for (let j = B - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  /** @type {number[]} */
  const onlyA = [];
  /** @type {number[]} */
  const onlyB = [];
  for (let i = 0, j = 0; i < A || j < B; ) {
    if (i < A && j < B && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < B && (i >= A || dp[i][j + 1] >= dp[i + 1][j])) onlyB.push(j++);
    else onlyA.push(i++);
  }
  return { common: dp[0][0], onlyA, onlyB };
}

/**
 * The binary's items left over, by kind: entry (01), LINKAGE (05) and external (02) pairs with
 * their names, set-location items (11, 13 absolute), the trailer's words (60), and any other.
 * @param {number[]} theirs
 * @param {number[]} left indexes into theirs
 * @returns {Record<string, number>}
 */
export function leftOver(theirs, left) {
  /** @type {Record<string, number>} */
  const kinds = {};
  const set = new Set(left);
  const add = (/** @type {string} */ k) => (kinds[k] = (kinds[k] ?? 0) + 1);
  for (let k = 0; k < left.length; k++) {
    const j = left[k];
    const tag = Math.floor(theirs[j] / 2 ** 24);
    if ((tag === 0o01 || tag === 0o02 || tag === 0o05) && set.has(j + 1)) {
      add(`${tag.toString(8).padStart(2, "0")} pair`);
      k++;
    } else if (tag === 0o11 || tag === 0o13 || tag === 0o60) add(`${tag.toString(8)} item`);
    else add("other");
  }
  return kinds;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [tape, only, show = "20"] = process.argv.slice(2);
  if (!tape) {
    console.error("usage: node tools/adept-check.mjs TAPE [NAME [N]]");
    process.exit(2);
  }
  const files = readTape(readFileSync(tape));
  const o = (/** @type {number} */ v) => v.toString(8).padStart(10, "0");
  let routines = 0;
  let passed = 0;
  let words = 0;
  /** @type {Record<string, number>} */
  const kinds = {};
  for (const f of files) {
    if (f.type !== "ATEXT" || (only && f.name !== only)) continue;
    const rel = files.find((g) => g.file === f.file + 1 && g.type === "RELOC" && g.name === f.name);
    if (!rel) continue;
    const r = assemble(new Core(), text(f.words), 0, { externals: "chain" });
    const ours = r.listing.flatMap((l) => l.words);
    const from = r.listing.flatMap((l) => l.words.map(() => l));
    const theirs = items(rel.records);
    const a = align(ours, theirs);
    for (const [k, n] of Object.entries(leftOver(theirs, a.onlyB))) kinds[k] = (kinds[k] ?? 0) + n;
    routines++;
    words += ours.length;
    const ok = a.onlyA.length === 0 && r.errors.length === 0;
    if (ok) passed++;
    console.log(`${f.file.toString(8).padStart(3, "0")} ${f.name.padEnd(6)} ${String(ours.length).padStart(5)} words  ${ok ? "same" : `${a.onlyA.length} not in the binary, ${r.errors.length} errors`}`);
    if (!only) continue;
    for (const e of r.errors.slice(0, Number(show))) console.log(`  line ${e.line}: ${e.message}`);
    for (const i of a.onlyA.slice(0, Number(show))) console.log(`  ${o(ours[i])} ${disassemble(ours[i]).padEnd(20)} line ${from[i].line}: ${from[i].text}`);
  }
  console.log(`\n${passed} of ${routines} routines assemble to their binaries' words (${words} words); the binaries' other items: ${JSON.stringify(kinds)}`);
}
