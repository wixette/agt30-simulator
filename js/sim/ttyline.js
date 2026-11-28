// SPDX-License-Identifier: Apache-2.0
//
// The Teletype's line, as the DPR-2 sees it (R17, R23): for AMRMX, which sends and receives
// each character a bit at a time (DPR2SPI p. 43). The simulator's own monitor does not use it.
//
// What AMRMX shows (research/amrmx.md):
// - IC bit 29 runs a bit clock. Each tick requests channel 5: the first seven of a character
//   through the pivot at 77750, the eighth through 77751.
// - Sending, the routine at 77750 puts the character, shifted, in BR and executes OPTY, which
//   puts BR[22] on the line: eight bits, the lowest first.
// - Receiving, the monitor sets IC bits 28 and 29. Each tick's routine shifts the character
//   right and takes the line's bit from S4[14] (SKUA 1) into its bit 7.
//
// Ours (R23): the rate, 110 baud, ten characters a second with a start and two stop bits;
// that with bit 28 set the clock waits for a character's start bit and its ticks fall in the
// middle of each data bit; that the line idles at 1 (mark); that the keyboard sends the eighth
// bit as 1, as the Model 33 does.

import { assembleOp } from "./dpr2.js";

/** The Teletype's channel (DPR2BD). */
export const TTY_CHANNEL = 5;
/** The pivots: a bit, and a character's eighth bit (AMRMX). */
export const BIT_PIVOT = 0o77750;
export const LAST_PIVOT = 0o77751;
/** IC bits: the bit clock, and receive. */
export const IC_CLOCK = 29;
export const IC_RECEIVE = 28;
/** The line's bit in the sense lines (DPR2BD; DPR2SPI p. 43). */
export const SENSE_LINE = 14;
/** 110 baud (R23). */
export const BIT_US = 1e6 / 110;
/** A character on the line: a start bit, eight data bits, two stop bits. */
export const CHAR_BITS = 11;

const BIT_PIW = assembleOp("JPSR", BIT_PIVOT, { I: true });
const LAST_PIW = assembleOp("JPSR", LAST_PIVOT, { I: true });

/** @param {number} w @param {number} b @returns {boolean} */
const icBit = (w, b) => Math.floor(w / 2 ** (29 - b)) % 2 === 1;

export class TtyLine {
  /**
   * @param {import("./dpr2.js").Dpr2} cpu
   * @param {(code: number) => void} printed a character the Teletype received from the computer: 8 bits
   * @param {(code: number) => void} [keyed] a key's character as it starts down the line, 7 bits: the
   *   Teletype at half duplex prints it then (R23)
   */
  constructor(cpu, printed, keyed = () => {}) {
    this.cpu = cpu;
    this.printed = printed;
    this.keyed = keyed;
    /** @type {(number | (() => void))[]} characters waiting to be sent from the keyboard, 8 bits
     * each, and things to do when the line reaches them (the simulator's, between keys) */
    this.keys = [];
    /** The character being received or sent, its bits so far, and when the next tick falls. */
    /** @type {{ dir: "in" | "out"; code: number; k: number; sent: number; next: number } | null} */
    this.char = null;
    /** When the keyboard may start its next character: a character takes CHAR_BITS bit times. */
    this.keyFree = 0;
    this.cpu.setSense(SENSE_LINE, true);
  }

  /**
   * A key pressed: its 7-bit code goes on the line with the eighth bit set.
   * @param {number} code
   */
  key(code) {
    this.keys.push((code & 0o177) | 0o200);
  }

  /** Whether characters are waiting to be sent from the keyboard. */
  get typing() {
    return this.keys.length > 0 || this.char?.dir === "in";
  }

  /**
   * OPTY's bit to the line.
   * @param {number} bit
   */
  strobe(bit) {
    const c = this.char;
    if (c?.dir === "out" && c.sent < 8) c.code |= bit << c.sent++;
  }

  /** Raises what is due by the processor's time. */
  poll() {
    const cpu = this.cpu;
    const t = cpu.time;
    const ic = cpu.IC;
    const clock = icBit(ic, IC_CLOCK);
    const receive = icBit(ic, IC_RECEIVE);
    if (!this.char) {
      // something to do between keys, when the line reaches it
      while (typeof this.keys[0] === "function") /** @type {() => void} */ (this.keys.shift())();
      if (receive && clock && this.keys.length && t >= this.keyFree) {
        // the start bit; the first tick falls in the middle of the first data bit
        this.char = { dir: "in", code: /** @type {number} */ (this.keys.shift()), k: 0, sent: 0, next: t + 1.5 * BIT_US };
        this.keyed(this.char.code & 0o177);
        this.keyFree = t + CHAR_BITS * BIT_US;
        cpu.setSense(SENSE_LINE, false);
      } else if (clock && !receive) {
        this.char = { dir: "out", code: 0, k: 0, sent: 0, next: t + BIT_US };
      }
      return;
    }
    const c = this.char;
    if (t < c.next) return;
    if (!clock) {
      // the clock stopped: the character is abandoned
      this.char = null;
      cpu.setSense(SENSE_LINE, true);
      return;
    }
    if (c.k < 8) {
      if (c.dir === "in") cpu.setSense(SENSE_LINE, ((c.code >> c.k) & 1) === 1);
      cpu.request(TTY_CHANNEL, c.k < 7 ? BIT_PIW : LAST_PIW);
      c.k++;
      c.next += BIT_US;
      return;
    }
    // the stop bits
    if (t < c.next + BIT_US) return;
    if (c.dir === "out") this.printed(c.code);
    cpu.setSense(SENSE_LINE, true);
    this.char = null;
  }
}
