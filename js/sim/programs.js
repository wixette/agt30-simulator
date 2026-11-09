// SPDX-License-Identifier: Apache-2.0
//
// The programs: ADEPT source files in programs/ and their manifest, programs/index.json (D6).
// The same files are read in the browser (by fetch) and in Node (from disk); the caller
// supplies the reading, so this module needs neither.

/**
 * A card action: a statement it types (U8).
 * @typedef {{ id: string; type: string }} Action
 */

/**
 * A card switch: the statement it types to turn a setting on, and to turn it off; the page shows
 * the machine's own state of that setting (depth: VIEW's DIM is not 0).
 * @typedef {{ id: "depth"; on: string; off: string }} Toggle
 */

/**
 * @typedef {object} Program
 * @property {string} id the link's program= (U13)
 * @property {string} source what it rebuilds, by bibliography key
 * @property {string[]} statements what the Programs menu types, in order
 * @property {string[]} controls what the visitor works: "dials", "dial0", "keys", "pen"
 * @property {Action[]} actions the card's buttons
 * @property {Toggle[]} toggles the card's switches
 * @property {string[]} files the source files its card shows, first its own
 * @property {string[]} reconstructions the R entries it rests on
 */

/**
 * @typedef {object} Manifest
 * @property {string[]} resident files assembled into core at start (R15)
 * @property {string[]} store files in the monitor's store, for ADEPT ("NAME")!
 * @property {Program[]} programs
 */

/**
 * Reads the manifest and every source file it names.
 * @param {(path: string) => Promise<string>} read reads a file of programs/ by name
 * @returns {Promise<{ manifest: Manifest; sources: Record<string, string> }>}
 */
export async function readPrograms(read) {
  const manifest = /** @type {Manifest} */ (JSON.parse(await read("index.json")));
  /** @type {Record<string, string>} */
  const sources = {};
  const names = [...manifest.resident, ...manifest.store];
  const texts = await Promise.all(names.map((n) => read(`${n}.adept`)));
  names.forEach((n, i) => (sources[n] = texts[i]));
  return { manifest, sources };
}
