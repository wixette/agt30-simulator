// SPDX-License-Identifier: Apache-2.0
//
// Test helpers: the programs read from disk, and a booted AGT-30.

import { readFile } from "node:fs/promises";
import { Agt30 } from "../js/sim/agt.js";
import { readPrograms } from "../js/sim/programs.js";

const DIR = new URL("../programs/", import.meta.url);

/** The manifest and sources, read once. */
export const PROGRAMS = await readPrograms((name) => readFile(new URL(name, DIR), "utf8"));

/** @returns {Agt30} a new AGT-30, as it starts */
export const boot = () => Agt30.boot(PROGRAMS.sources);

/**
 * Types text and runs the machine until the Teletype is idle, then a little longer.
 * @param {Agt30} agt
 * @param {string} text
 * @param {number} [settleUs] how long to run once all is typed and printed
 */
export function typeAndRun(agt, text, settleUs = 100000) {
  agt.type(text);
  let guard = 0;
  while (agt.busy && guard++ < 10000) agt.advance(agt.now + 100000);
  agt.advance(agt.now + settleUs);
}

/**
 * Runs a program from the manifest as the Programs menu does.
 * @param {Agt30} agt
 * @param {string} id
 */
export function load(agt, id) {
  const p = PROGRAMS.manifest.programs.find((q) => q.id === id);
  if (!p) throw new Error(`no program ${id}`);
  typeAndRun(agt, p.statements.join(""));
  return p;
}
