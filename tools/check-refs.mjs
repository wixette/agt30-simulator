// SPDX-License-Identifier: Apache-2.0
//
// The reference check, `pnpm check:refs` (docs/conventions.md, "References"). The
// repository is public, so everything in it must be readable and followable by anyone.
// It fails on:
//
//   1. a forbidden name: a name of private material. The names are held only as SHA-256
//      digests (FORBIDDEN), so they appear nowhere in the repository, not even in pieces.
//      Every word of a file, and every run of two to four consecutive words joined by a
//      hyphen or by nothing, is lower-cased, hashed and compared;
//   2. an absolute path on a developer's machine (/Users/<name>/…, /home/<name>/…,
//      C:\Users\<name>…);
//   3. a relative link, in Markdown or HTML, that leaves the repository or points at a
//      file that does not exist.
//
// It reads every file git tracks or would track, so new files are checked before they are
// committed. It skips binary files and the vendored libraries (copied unchanged from npm).
// CI runs it on every push and pull request.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** SHA-256 digests (hex) of the lower-cased forbidden names. */
export const FORBIDDEN = new Set([
  "11b3eb8bf69fd731c9af4db46ede59d5a375305765f2f16134769e6075bc6c22",
  "3375e0278394aa935591641cc7d8d469e8f549746d5dcdd2d03ed47048907908",
  "737f59eac62477359fc3819b35fd5ccc71b60320a332a28073d01eecfb8f2e90",
]);

/** The longest run of words compared as one name. */
const MAX_RUN = 4;

const LOCAL_PATH = [
  /(?:^|[^\w.:/])\/(?:Users|home)\/[A-Za-z0-9._-]+\//, // /Users/<name>/… and /home/<name>/…
  /\b[A-Za-z]:\\Users\\[^\\\s]+\\/, // C:\Users\<name>…
];

/** @type {Map<string, string>} */
const digests = new Map();
/** @param {string} s */
function sha256(s) {
  let d = digests.get(s);
  if (d === undefined) {
    d = createHash("sha256").update(s).digest("hex");
    digests.set(s, d);
  }
  return d;
}

/**
 * The candidate names in a line: each word, and each run of 2 to MAX_RUN consecutive
 * words joined by "-" and by "".
 * @param {string} line
 * @returns {string[]}
 */
export function candidates(line) {
  const words = line.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = [];
  for (let i = 0; i < words.length; i++) {
    out.push(words[i]);
    for (let n = 2; n <= MAX_RUN && i + n <= words.length; n++) {
      const run = words.slice(i, i + n);
      out.push(run.join("-"), run.join(""));
    }
  }
  return out;
}

/**
 * Problems in one file's text that do not depend on other files: forbidden names, local paths.
 * @param {string} file
 * @param {string} text
 * @param {Set<string>} [forbidden] digests to look for
 * @returns {string[]}
 */
export function checkText(file, text, forbidden = FORBIDDEN) {
  /** @type {string[]} */
  const problems = [];
  text.split("\n").forEach((line, i) => {
    if (candidates(line).some((c) => forbidden.has(sha256(c)))) problems.push(`${file}:${i + 1}: names private material`);
    for (const re of LOCAL_PATH) {
      if (re.test(line)) problems.push(`${file}:${i + 1}: absolute local path`);
    }
  });
  return problems;
}

/**
 * Link targets in Markdown or HTML text, with their line numbers (code is skipped).
 * @param {string} file
 * @param {string} text
 * @returns {{ target: string, line: number }[]}
 */
export function linkTargets(file, text) {
  /** @type {{ target: string, line: number }[]} */
  const out = [];
  const md = file.endsWith(".md");
  let fenced = false;
  text.split("\n").forEach((line, i) => {
    if (md && /^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const scan = md ? line.replace(/`[^`]*`/g, "") : line; // inline code is not a link
    // [text](target "title"), or [text](<target with spaces>)
    if (md) for (const m of scan.matchAll(/\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g)) out.push({ target: m[1] ?? m[2], line: i + 1 });
    for (const m of scan.matchAll(/\b(?:href|src|srcset)\s*=\s*["']([^"']+)["']/g)) {
      for (const part of m[1].split(",")) out.push({ target: part.trim().split(/\s+/)[0], line: i + 1 });
    }
  });
  return out;
}

/** @param {string} t */
const external = (t) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(t) || t === "";

/**
 * Relative links that leave the repository or point at nothing.
 * @param {string} root
 * @param {string} file
 * @param {string} text
 * @returns {string[]}
 */
export function checkLinks(root, file, text) {
  /** @type {string[]} */
  const problems = [];
  for (const { target, line } of linkTargets(file, text)) {
    if (external(target)) continue;
    let clean;
    try {
      clean = decodeURIComponent(target.split("#")[0].split("?")[0]);
    } catch {
      problems.push(`${file}:${line}: malformed link (${target})`);
      continue;
    }
    if (clean === "") continue;
    const resolved = clean.startsWith("/") ? path.join(root, clean) : path.resolve(root, path.dirname(file), clean);
    const rel = path.relative(root, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) problems.push(`${file}:${line}: link leaves the repository (${target})`);
    else if (!existsSync(resolved)) problems.push(`${file}:${line}: broken link (${target})`);
  }
  return problems;
}

const LINKED = /\.(md|html)$/;
/** The check's own tests spell out local paths on purpose. */
const SELF = new Set(["tools/check-refs.test.mjs"]);
const MAX_BYTES = 4 * 1024 * 1024;

/** @param {Buffer} buf */
const isBinary = (buf) => buf.subarray(0, 8192).includes(0);

/**
 * Check every tracked or trackable file under root.
 * @param {string} root
 * @returns {string[]} the problems found
 */
export function checkRepository(root) {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root })
    .toString()
    .split("\0")
    .filter(Boolean);
  /** @type {string[]} */
  const problems = [];
  for (const file of files) {
    if (SELF.has(file) || file.startsWith("vendor/")) continue;
    const full = path.join(root, file);
    if (!existsSync(full) || statSync(full).size > MAX_BYTES) continue;
    const buf = readFileSync(full);
    if (isBinary(buf)) continue;
    const text = buf.toString("utf8");
    problems.push(...checkText(file, text));
    if (LINKED.test(file)) problems.push(...checkLinks(root, file, text));
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"]).toString().trim();
  const problems = checkRepository(root);
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\ncheck:refs: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    process.exit(1);
  }
  console.log("check:refs: no private references, local paths or broken links");
}
