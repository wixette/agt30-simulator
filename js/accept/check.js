// SPDX-License-Identifier: Apache-2.0
//
// The acceptance checks' small toolkit, shared by the Node tests (tests/accept.test.js) and the
// page's ?selftest: one list of checks, each named by its ID (docs/conventions.md, Tests). It
// needs neither Node nor the DOM, so it uses its own assertions.

/**
 * What a check is given.
 * @typedef {object} Context
 * @property {() => import("../sim/agt.js").Agt30} boot a new AGT-30, as it starts
 * @property {import("../sim/programs.js").Manifest} manifest
 * @property {Record<string, string>} sources
 */

/**
 * @typedef {object} Check
 * @property {string} id e.g. "DSP-3"
 * @property {string} title what it checks, with its source
 * @property {(ctx: Context) => void} run throws when the check fails
 */

export class CheckError extends Error {}

/**
 * @param {unknown} cond
 * @param {string} message
 * @returns {asserts cond}
 */
export function ok(cond, message) {
  if (!cond) throw new CheckError(message);
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} message
 */
export function equal(actual, expected, message) {
  if (actual !== expected) throw new CheckError(`${message}: got ${String(actual)}, expected ${String(expected)}`);
}

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} tolerance absolute
 * @param {string} message
 */
export function near(actual, expected, tolerance, message) {
  if (!(Math.abs(actual - expected) <= tolerance)) throw new CheckError(`${message}: got ${actual}, expected ${expected} +- ${tolerance}`);
}

/**
 * Types text and runs the machine until the keyboard and printer are idle, then a little more.
 * @param {import("../sim/agt.js").Agt30} agt
 * @param {string} text
 * @param {number} [settleUs]
 */
export function typeAndRun(agt, text, settleUs = 100000) {
  agt.type(text);
  for (let guard = 0; agt.busy && guard < 10000; guard++) agt.advance(agt.now + 100000);
  agt.advance(agt.now + settleUs);
}

/**
 * Runs a program as the Programs menu does: types its statements (U8).
 * @param {Context} ctx
 * @param {import("../sim/agt.js").Agt30} agt
 * @param {string} id
 */
export function load(ctx, agt, id) {
  const p = ctx.manifest.programs.find((q) => q.id === id);
  ok(p, `no program ${id}`);
  typeAndRun(agt, p.statements.join(""));
  return p;
}
