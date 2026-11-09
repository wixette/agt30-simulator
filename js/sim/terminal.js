// SPDX-License-Identifier: Apache-2.0
//
// The display terminal as it runs: core, the array, DSPLY started on an image at a RATE, the
// frame clock, the timing-error options and the CLOCK chain (DSPLY pp. 7-10).
//
// Simulated time, in microseconds, is the master clock (D2). The display clock interrupts at
// 120 / (RATE + 1) frames a second, and on each tick DSPLY interprets the image again from the
// top. A frame not finished by the next tick is a timing error, and ERRORT decides what
// happens (p. 8):
// - ALL finishes the frame and waits for the next tick, so the picture refreshes more slowly;
// - CUT stops the frame at the tick, so the end of the picture is lost;
// - BUMP raises RATE until the picture fits, and tells the operator on the Teletype.
//
// The CLOCK chain runs once a frame, at the tick, so a dial turned now shows in the next frame.

import { HybridArray } from "./array.js";
import { Dsply } from "./dsply.js";
import { DEFAULT_RATE, rateFor, tickUs } from "./frameclock.js";
import { Core } from "./image.js";

/** @typedef {import("./dsply.js").Seg} Seg */
/** @typedef {"ALL" | "CUT" | "BUMP"} TimingOption */

/** How long strokes are kept for the views, us: longer than any phosphor's visible decay. */
export const KEEP_US = 400000;
/** How many frames are remembered. */
const KEEP_FRAMES = 240;

/**
 * @typedef {object} FrameRecord
 * @property {number} start when it started (us)
 * @property {number} end when its last vector ended (us)
 * @property {number} vectors
 * @property {number} drawn
 * @property {number} items
 * @property {number} cpu processor time DSPLY spent (us)
 * @property {boolean} cut stopped at the frame's end (CUT)
 * @property {boolean} late it overran its tick
 * @property {number} rate the RATE it ran at
 */

export class Terminal {
  constructor() {
    this.core = new Core();
    this.array = new HybridArray();
    this.dsply = new Dsply(this.core, this.array);
    /** Simulated time, us. */
    this.now = 0;
    /** @type {number | null} the image displayed (its header's address), or null when halted */
    this.image = null;
    this.rate = DEFAULT_RATE;
    /** @type {TimingOption} ERRORT; initially ALL (p. 9) */
    this.errort = "ALL";
    /** When the next frame starts. */
    this.nextTick = 0;
    /** @type {Seg[]} strokes with absolute times, oldest first, kept KEEP_US */
    this.segs = [];
    /** @type {FrameRecord[]} recent frames, newest last */
    this.frames = [];
    /** @type {(text: string) => void} what DSPLY types on the Teletype */
    this.typeout = () => {};
  }

  /**
   * DSPLY (IMAGE, RATE, ERRORI, ERRORT)! (p. 7). Omitted arguments keep their values (p. 8).
   * @param {number} image
   * @param {number} [rate]
   * @param {TimingOption} [errort]
   */
  start(image, rate, errort) {
    this.image = image;
    if (rate !== undefined) this.rate = rate;
    if (errort !== undefined) this.errort = errort;
    this.nextTick = this.nextTickAfter(this.now);
  }

  /** HALT! (p. 8): stops all display. */
  halt() {
    this.image = null;
  }

  /**
   * The first tick at or after a time. The clock runs whatever DSPLY does.
   * @param {number} t
   * @returns {number}
   */
  nextTickAfter(t) {
    const p = tickUs(this.rate);
    return Math.ceil(t / p - 1e-9) * p;
  }

  /**
   * Runs the terminal up to a time: every frame whose tick falls before it.
   * @param {number} until us
   */
  advance(until) {
    let guard = 0;
    while (this.image !== null && this.nextTick <= until && guard++ < 1000) this.runFrame();
    this.now = until;
    const keep = until - KEEP_US;
    let i = 0;
    while (i < this.segs.length && this.segs[i].t1 < keep) i++;
    if (i) this.segs.splice(0, i);
  }

  /** Runs the CLOCK chain: once a frame, at the tick (p. 9). Agt30 runs DPR-2 routines here. */
  runClock() {}

  /** One frame, at the next tick. */
  runFrame() {
    if (this.image === null) return;
    const start = this.nextTick;
    this.runClock();
    if (this.image === null) return;
    const budget = tickUs(this.rate);
    const r = this.dsply.frame(this.image, { budget, cut: this.errort === "CUT" });
    for (const s of r.segs) this.segs.push({ ...s, t0: s.t0 + start, t1: s.t1 + start });
    const late = r.end > budget;
    this.frames.push({ start, end: start + r.end, vectors: r.vectors, drawn: r.drawn, items: r.items, cpu: r.cpu, cut: r.cut, late, rate: this.rate });
    if (this.frames.length > KEEP_FRAMES) this.frames.shift();
    // ERRORI is SKIP, its initial value (p. 9): name the faulty item and go on (p. 8)
    for (const e of r.errors) this.typeout(`${e.toUpperCase()}\r\n`);
    if (late && this.errort === "BUMP") {
      const rate = rateFor(r.end, this.rate);
      if (rate !== this.rate) {
        this.rate = rate;
        this.typeout(`RATE ${rate}\r\n`);
      }
    }
    this.nextTick = late && this.errort !== "CUT" ? this.nextTickAfter(start + r.end) : start + tickUs(this.rate);
  }

  /**
   * Frames shown in the last second of simulated time, and the last frame.
   * @returns {{ fps: number; last: FrameRecord | null }}
   */
  stats() {
    const since = this.now - 1e6;
    const recent = this.frames.filter((f) => f.start > since && f.start <= this.now);
    const span = Math.min(1e6, this.now);
    return { fps: span > 0 ? (recent.length * 1e6) / span : 0, last: this.frames.at(-1) ?? null };
  }
}
