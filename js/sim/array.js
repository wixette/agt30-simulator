// SPDX-License-Identifier: Apache-2.0
//
// The hybrid coordinate transformation array of the AGT-30 (FJCC68 p. 751, eqs. 5-7; GIM72
// Fig. 9):
//
//     x' = PS [ DX + SC (R11 x + R12 y + R13 z) ]
//     y' = PS [ DY + SC (R21 x + R22 y + R23 z) ]
//     z' = PS [ DZ + SC (R31 x + R32 y + R33 z) ]
//
// Every coefficient sits in a register as a 15-bit one's-complement fraction, loaded by the
// processor. Each multiplication is a multiplying DAC, whose digital input is the coefficient
// and whose analog input is the signal coming in; each sum is an operational amplifier. x, y
// and z enter as 15-bit numbers and leave as voltages, full scale +-10 V, which the vector
// generator takes as +-10 inches (DSPLY p. 22: full scale spans a 20-inch square).
//
// The array computes exactly on the quantised numbers (D8). Its analog error is modelled but
// off: every MDAC has a small gain error and every row's amplifiers an offset, which drift
// until the array is recalibrated, "about once a year" (CCT20). `drift` (0 = just calibrated,
// 1 = a year on) scales them. The sizes of the errors are our estimate (R5), drawn from a
// fixed seed so that one machine keeps its own faults.

import { fromFrac } from "./words.js";

/** The registers, by name, in the order the diagrams draw them. */
export const REGISTERS = /** @type {const} */ (["R11", "R12", "R13", "R21", "R22", "R23", "R31", "R32", "R33", "SC", "DX", "DY", "DZ", "PS"]);
/** @typedef {typeof REGISTERS[number]} RegName */

/** The settling time of an output to 0.01 % (SRM5 GHA4). */
export const SETTLE_US = 2;
/** Every multiplication and summation of one transformation, within (FJCC68 p. 751). */
export const TRANSFORM_US = 4;
/** A multiplier's gain error a year after calibration, at most (R5, our estimate). */
export const DRIFT_GAIN = 0.012;
/** A row's offset a year after calibration, at most, as a fraction of full scale (R5). */
export const DRIFT_OFFSET = 0.004;

/**
 * A small deterministic random source (mulberry32).
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One row of a transformation, stage by stage.
 * @typedef {object} RowValues
 * @property {number[]} products the three MDAC outputs Ri1 x, Ri2 y, Ri3 z (fractions)
 * @property {number} sum their sum
 * @property {number} scaled after SC
 * @property {number} placed after adding D
 * @property {number} out after PS: the output, as a fraction of full scale (clamped to +-1)
 */

export class HybridArray {
  constructor() {
    /** @type {Record<RegName, number>} the registers' half-words */
    this.reg = /** @type {Record<RegName, number>} */ ({});
    for (const r of REGISTERS) this.reg[r] = 0;
    this.reg.R11 = this.reg.R22 = this.reg.R33 = this.reg.SC = this.reg.PS = 0o37777;
    /** 0 = just calibrated; 1 = a year since calibration (D8: 0 in v0.0.1). */
    this.drift = 0;
    /** Register loads since reset. */
    this.loads = 0;
    /** Transformations since reset. */
    this.transforms = 0;
    const r = rng(1968);
    /** @type {number[]} gain error of each of the 15 MDACs (9 rotation, 3 SC, 3 PS) at drift 1 */
    this.gainErr = Array.from({ length: 15 }, () => (r() * 2 - 1) * DRIFT_GAIN);
    /** @type {number[]} offset of each row's summing amplifiers at drift 1 */
    this.offsetErr = Array.from({ length: 3 }, () => (r() * 2 - 1) * DRIFT_OFFSET);
  }

  /**
   * Loads a register with a half-word, as the processor does over the transfer bus.
   * @param {RegName} name
   * @param {number} half
   */
  load(name, half) {
    this.reg[name] = half;
    this.loads++;
  }

  /**
   * The value of a register as a fraction.
   * @param {RegName} name
   * @returns {number}
   */
  value(name) {
    return fromFrac(this.reg[name]);
  }

  /**
   * Transforms one point: three 15-bit inputs in, three analog outputs out (fractions of full
   * scale; times 10 for volts or inches).
   * @param {number} xh
   * @param {number} yh
   * @param {number} zh
   * @returns {[number, number, number]}
   */
  transform(xh, yh, zh) {
    this.transforms++;
    const rows = this.rows(this.reg, [xh, yh, zh]);
    return [rows[0].out, rows[1].out, rows[2].out];
  }

  /**
   * One transformation, row by row, for given registers and inputs.
   * @param {Record<RegName, number>} reg half-words
   * @param {[number, number, number]} input x, y, z half-words
   * @returns {RowValues[]}
   */
  rows(reg, input) {
    const v = input.map(fromFrac);
    const g = (/** @type {number} */ k) => 1 + this.gainErr[k] * this.drift;
    const val = (/** @type {RegName} */ n) => fromFrac(reg[n]);
    const R = [
      [val("R11"), val("R12"), val("R13")],
      [val("R21"), val("R22"), val("R23")],
      [val("R31"), val("R32"), val("R33")],
    ];
    const D = [val("DX"), val("DY"), val("DZ")];
    const sc = val("SC");
    const ps = val("PS");
    /** @type {RowValues[]} */
    const rows = [];
    for (let i = 0; i < 3; i++) {
      const products = [0, 1, 2].map((j) => R[i][j] * v[j] * g(i * 3 + j));
      const sum = products[0] + products[1] + products[2] + this.offsetErr[i] * this.drift;
      const scaled = sum * sc * g(9 + i);
      const placed = D[i] + scaled;
      rows.push({ products, sum, scaled, placed, out: Math.max(-1, Math.min(1, placed * ps * g(12 + i))) });
    }
    return rows;
  }
}
