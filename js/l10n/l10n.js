// SPDX-License-Identifier: Apache-2.0
//
// The page's words (docs/ui-design.md, U11): every text a reader sees is a message, by key, in
// js/l10n/en.js. English is the only language in v0.0.x; the lookup is the place another would
// plug in. Pure logic, no DOM: the page and the tests share it. A message may hold {name}
// placeholders, filled from the params of t(). The machine's own voice (statements, the paper,
// ADEPT source) is data, not a message (P5).

import en from "./en.js";

/** @typedef {Record<string, string>} Messages */

/** @type {Messages} */
let table = en;

/**
 * Uses another table of messages (for tests).
 * @param {Messages} messages
 */
export function useMessages(messages) {
  table = messages;
}

/**
 * Whether a key has a message.
 * @param {string} key
 * @returns {boolean}
 */
export const has = (key) => key in table;

/**
 * A message, with its placeholders filled. A key without a message comes back as itself, so a
 * missing text shows rather than breaks (and tests/l10n.test.js fails).
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const msg = table[key] ?? key;
  return msg.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

/**
 * A number as English writes it: 1,000.
 * @param {number} n
 * @returns {string}
 */
export const num = (n) => n.toLocaleString("en");
