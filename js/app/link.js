// SPDX-License-Identifier: Apache-2.0
//
// The page's link format (docs/ui-design.md, U13; P8): #view=<viewpoint>&program=<id>. It is
// not frozen before 1.0.0. A link never carries octal words: the instruction encodings are
// reconstructed and may change (R1). Pure: no DOM; tests/link.test.js pins it down.

/** The viewpoints, by the names links use (V6). */
export const VIEWS = /** @type {const} */ (["room", "console", "screen", "tube"]);
/** @typedef {(typeof VIEWS)[number]} View */

/**
 * @typedef {object} Link
 * @property {View} [view]
 * @property {string} [program] a program's id, as programs/index.json gives it
 */

/**
 * Reads a link's fragment. Unknown fields and values are ignored.
 * @param {string} hash e.g. "#view=tube&program=cube"
 * @param {readonly string[]} programs the known program ids
 * @returns {Link}
 */
export function parseLink(hash, programs) {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  /** @type {Link} */
  const link = {};
  const v = q.get("view");
  if (v && /** @type {readonly string[]} */ (VIEWS).includes(v)) link.view = /** @type {View} */ (v);
  const p = q.get("program");
  if (p && programs.includes(p)) link.program = p;
  return link;
}

/**
 * Writes a link's fragment; the Room viewpoint, the way in, is left out.
 * @param {Link} link
 * @returns {string} "" or "#..."
 */
export function formatLink(link) {
  const q = new URLSearchParams();
  if (link.view && link.view !== "room") q.set("view", link.view);
  if (link.program) q.set("program", link.program);
  const s = q.toString();
  return s ? `#${s}` : "";
}
