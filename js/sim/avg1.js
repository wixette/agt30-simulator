// SPDX-License-Identifier: Apache-2.0
//
// AVG1, the vector generator, and the array's registers as the DPR-2 sees them: for a program
// that drives the display itself, as AMRMX's display handler and the games do (R22). The
// simulator's own DSPLY (dsply.js) draws through the array directly and does not use this.
//
// What the programs show (DISP2, AMRMX's display handler, LIFE; research/amrmx.md):
// - D05 takes a vector word: X in bits 0-13, end of list in 14, Y in 15-28, draw in 29 (the
//   layout of DSPLY's tables). Sending one starts the vector through the array.
// - When a vector ends, AVG1 asks for service on channel 11. Within a list the instruction it
//   supplies sends the next word: MDIR'X 77756, which steps the end-of-vector pivot, an MDXY of
//   the word just drawn, and executes it. AMRMX sends a list's first word by executing the pivot
//   (MDIR 77756), and gives some lists a rotation there ('K) that every word must get. After a
//   word with the end-of-list flag AVG1 calls the routine at the end-of-list pivot, JPSR'I 77757
//   (DISP2's EOLS).
// - D10's upper half is AVG1's mode and enable: bits 0 and 1 together turn it on (DISP2's
//   AVGON), bit 5 the display clock (CLON), bits 6-9 unblank scopes A-D (GDS1). Its lower half
//   is the function switches' lights.
// - D06 takes AVG1's command in its upper half and z for the array in its lower (DPR2BD).
// - D07 with IC bit 10 clear loads an array register: its number in the low five bits of the
//   upper half, the value in the lower half. With the bit set it goes to GDD1, the input
//   selector, as before (the dials).
// - The display clock interrupts on channel 8 through 77755 (DISP2's DCLPV).
//
// Ours (R22): which register number is which (only SC 05, DX 15, DY 16, DZ 17 and PS 20 are
// placed, from what AMRMX does with them); that 100 in the upper half resets the array to the
// identity first; the clock's 120 a second; that a word sent to D05 while a vector is drawn
// waits for it to end.

import { CLAMP_IN, INCH_PER_FS, vectorTime } from "./vecgen.js";
import { assembleOp } from "./dpr2.js";
import { from14 } from "./dsply.js";
import { bits, hi, lo, toFrac } from "./words.js";

/** The priority channels (DPR2BD). */
export const CLOCK_CHANNEL = 8;
export const AVG_CHANNEL = 11;
/** The pivots (DISP2). */
export const DCLPV = 0o77755;
export const EOVPV = 0o77756;
export const EOLPV = 0o77757;
/** What AVG1 supplies on S8 at a vector's end, and at a list's (R22). */
export const EOV_PIW = assembleOp("MDIR", EOVPV, { X: true });
export const EOL_PIW = assembleOp("JPSR", EOLPV, { I: true });
export const CLOCK_PIW = assembleOp("JPSR", DCLPV, { I: true });
/** The display clock's period, us: 120 a second (frameclock.js). */
export const CLOCK_US = 1e6 / 120;
/** IC bit 10 sends D07 to GDD1, the input selector; clear, to the array's registers (DPR2BD, R22). */
export const IC_GDD1 = 10;
/** D10 upper-half bits (DISP2, GDS1). */
export const MODE = { ON: [0, 1], CLOCK: 5, SCOPES: [6, 9] };
/** Array register numbers as D07 gives them (R22); the rest are kept but not used. */
export const ARRAY_REGS = /** @type {const} */ ({ 0o05: "SC", 0o06: "R11", 0o07: "R22", 0o10: "R33", 0o11: "R13", 0o13: "R23", 0o15: "DX", 0o16: "DY", 0o17: "DZ", 0o20: "PS" });
/** D07's register that selects the converter's input, one bit a channel (R7, R22). */
export const SELECTOR_REG = 0o01;
/** The bit in D07's upper half that resets the array to the identity (R22). */
export const ARRAY_RESET = 0o100;
/** The bit in D07's upper half that starts a run of words loading this register and the next ones (R22). */
export const ARRAY_RUN = 0o200;

/** @param {number} half @param {number} b Adage bit 0-14 of a half-word @returns {boolean} */
const halfBit = (half, b) => Math.floor(half / 2 ** (14 - b)) % 2 === 1;

export class Avg1 {
  /**
   * @param {import("./dpr2.js").Dpr2} cpu
   * @param {import("./array.js").HybridArray} array
   */
  constructor(cpu, array) {
    this.cpu = cpu;
    this.array = array;
    /** D10's upper half (mode and enable) and lower half (the lights). */
    this.mode = 0;
    this.lights = 0;
    /** D06: the command and z. */
    this.command = 0;
    this.z = 0;
    /** @type {{ next: number } | null} a run of loads under way (ARRAY_RUN) */
    this.run = null;
    /** Every register D07 has loaded, by number, as half-words (32 places). */
    this.loaded = new Array(32).fill(0);
    /** The beam, inches from the center. */
    this.beam = { x: 0, y: 0 };
    /** The vector being drawn: when it ends and whether it ends its list; null when idle. */
    /** @type {{ end: number; eol: boolean } | null} */
    this.drawing = null;
    /** When the display clock next ticks, or null while it is off. */
    /** @type {number | null} */
    this.nextClock = null;
    /** @type {import("./dsply.js").Seg[]} strokes drawn since the last take() */
    this.segs = [];
    this.vectors = 0;
  }

  /** Whether AVG1 is on: D10 bits 0 and 1. */
  get on() {
    return halfBit(this.mode, MODE.ON[0]) && halfBit(this.mode, MODE.ON[1]);
  }

  /** Whether any scope is unblanked. */
  get unblanked() {
    for (let b = MODE.SCOPES[0]; b <= MODE.SCOPES[1]; b++) if (halfBit(this.mode, b)) return true;
    return false;
  }

  /**
   * A transfer to a subsystem's destination (Devices.write).
   * @param {number} dst
   * @param {number} v
   * @param {number} logic 1 'O, 2 'A
   * @returns {boolean} whether AVG1 or the array took it
   */
  write(dst, v, logic) {
    switch (dst) {
      case 0o05:
        this.send(v);
        return true;
      case 0o06:
        this.command = hi(v);
        this.z = lo(v);
        return true;
      case 0o07:
        if (Math.floor(this.cpu.IC / 2 ** (29 - IC_GDD1)) % 2 === 1) return false;
        this.load(hi(v), lo(v));
        return true;
      case 0o10: {
        /** @param {number} old @param {number} h @returns {number} */
        const apply = (old, h) => (logic === 1 ? old | h : logic === 2 ? old & h : h);
        const clockWas = halfBit(this.mode, MODE.CLOCK);
        this.mode = apply(this.mode, hi(v));
        this.lights = apply(this.lights, lo(v));
        const clock = halfBit(this.mode, MODE.CLOCK);
        if (clock && !clockWas) this.nextClock = this.cpu.time + CLOCK_US;
        if (!clock) this.nextClock = null;
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * D07 to the array: a register's number and its value; ARRAY_RESET first resets it (R22).
   * @param {number} upper
   * @param {number} value
   */
  load(upper, value) {
    // 0200 in the upper half starts a run: the words that follow with no register in their upper
    // half (its low five bits zero) load this register and the ones after it, from their lower
    // halves, until a word names a register again. QUBIC and BROSE load 03-22 so, sixteen words;
    // LIFE places each cell so, 15 and 16; AMRMX loads 06 and 07 (R22).
    if (this.run && (upper & 0o37) === 0) {
      const r = this.run.next++ & 0o37;
      this.loaded[r] = value;
      const nm = ARRAY_REGS[/** @type {keyof typeof ARRAY_REGS} */ (r)];
      if (nm) this.array.load(nm, value);
      return;
    }
    this.run = null;
    if (upper & ARRAY_RUN) {
      if (upper & ARRAY_RESET) this.resetArray();
      this.run = { next: upper & 0o37 };
      return;
    }
    if (upper & ARRAY_RESET) this.resetArray();
    const n = upper & 0o37;
    // register 01 is the input selector, one bit a channel, and selecting starts a conversion:
    // LIFE reads its speed dial so, and QUBIC and BROSE the six dials, 1, 2, 4 ... 40 (R7, R22)
    if (n === SELECTOR_REG && value) {
      let ch = 0;
      while (ch < 15 && !(value & (1 << ch))) ch++;
      this.cpu.mux = ch;
      this.cpu.convert();
    }
    this.loaded[n] = value;
    const name = ARRAY_REGS[/** @type {keyof typeof ARRAY_REGS} */ (n)];
    if (name) this.array.load(name, value);
  }

  /** The array as after a reset: the identity, at full scale, at the origin (R22). */
  resetArray() {
    const a = this.array;
    for (const r of ["R12", "R13", "R21", "R23", "R31", "R32", "DX", "DY", "DZ"]) a.load(/** @type {any} */ (r), 0);
    for (const r of ["R11", "R22", "R33", "SC", "PS"]) a.load(/** @type {any} */ (r), 0o37777);
  }

  /**
   * A vector word to D05: the beam goes to its end point through the array.
   * @param {number} w
   */
  send(w) {
    if (!this.on) return;
    const cpu = this.cpu;
    // a word sent while a vector is drawn waits for it (R22)
    if (this.drawing && this.drawing.end > cpu.time) cpu.time = this.drawing.end;
    const fx = from14(bits(w, 0, 13));
    const fy = from14(bits(w, 15, 28));
    const eol = bits(w, 14, 14) === 1;
    const draw = bits(w, 29, 29) === 1;
    const [ox, oy] = this.array.transform(toFrac(fx), toFrac(fy), this.z);
    const x = Math.max(-CLAMP_IN, Math.min(CLAMP_IN, ox * INCH_PER_FS));
    const y = Math.max(-CLAMP_IN, Math.min(CLAMP_IN, oy * INCH_PER_FS));
    const len = Math.max(Math.abs(x - this.beam.x), Math.abs(y - this.beam.y));
    const t0 = cpu.time;
    const t1 = t0 + vectorTime(len, draw);
    const vis = draw && this.unblanked;
    this.segs.push({ t0, t1, x0: this.beam.x, y0: this.beam.y, x1: x, y1: y, i0: 1, i1: 1, vis, item: 0 });
    this.vectors++;
    this.beam = { x, y };
    this.drawing = { end: t1, eol };
  }

  /**
   * Raises what is due by the processor's time: a vector's end, the display clock.
   */
  poll() {
    const cpu = this.cpu;
    const d = this.drawing;
    if (d && cpu.time >= d.end) {
      this.drawing = null;
      cpu.request(AVG_CHANNEL, d.eol ? EOL_PIW : EOV_PIW);
    }
    if (this.nextClock !== null && cpu.time >= this.nextClock) {
      this.nextClock += CLOCK_US;
      cpu.request(CLOCK_CHANNEL, CLOCK_PIW);
    }
  }

  /**
   * The strokes drawn since the last call.
   * @returns {import("./dsply.js").Seg[]}
   */
  take() {
    const s = this.segs;
    this.segs = [];
    return s;
  }

  /** As at power on: off, the array reset. */
  clear() {
    this.mode = this.lights = this.command = this.z = 0;
    this.loaded.fill(0);
    this.drawing = null;
    this.nextClock = null;
    this.run = null;
    this.resetArray();
  }
}
