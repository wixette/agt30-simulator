// SPDX-License-Identifier: Apache-2.0
//
// DMS2, the disk, as AMRMX drives it (R24): a pack image in, transfers to and from core, and the
// interrupts that end each operation. What the controller does is read from AMLD0's source and
// AMRMX's driver on M. Howard's pack (research/amrmx.md):
// - the command word is in 77720 and the transfer word in 77721; setting IC bit 5 starts the
//   controller, and S4 bit 5 is its ready line;
// - the command's upper half names the operation in its 07000 bits: 03000 seeks home; 02000 seeks
//   by the lower half's number of cylinders times 16, toward cylinder 0 when its bit 0 (40000)
//   is set; 06000 reads from the sector the lower half gives, counted from the start of the pack;
// - the transfer word gives the count in bits 0-12 and, in its lower half, the address before
//   the first word, which the controller steps as it goes;
// - the status word, 77722, is 0 when all went well;
// - an operation ends with a request on channel 3 through its pivot: 77723 a transfer's normal
//   end, 77725 a seek's.
//
// Ours (R24): the times (a seek 15 ms, home 20 ms, a transfer 2 ms and 20 us a word); that the
// other operations (04000, 05000, 07000, among them a write) end at once and move no data, the
// pack being read only.

import { assembleOp } from "./dpr2.js";
import { hi, lo, word } from "./words.js";

/** The disk's channel (DPR2BD). */
export const DISK_CHANNEL = 3;
/** The controller's words in core (AMLD0). */
export const COMMAND = 0o77720;
export const TRANSFER = 0o77721;
export const STATUS = 0o77722;
/** The end pivots (AMLD0). */
export const END_PIVOT = 0o77723;
export const ERROR_PIVOT = 0o77724;
export const SEEK_PIVOT = 0o77725;
/** IC bit 5 starts the controller; S4 bit 5 is its ready line. */
export const IC_START = 5;
export const SENSE_READY = 5;
/** A pack's geometry: 104 words a sector, 16 sectors a cylinder (research/amrmx.md). */
export const SECTOR_WORDS = 104;
export const CYLINDER_SECTORS = 16;
/** The operations, in the command's upper half. */
export const OP = { SEEK: 0o02000, HOME: 0o03000, READ: 0o06000 };
/** Times, us (R24). */
export const TIME = { seek: 15000, home: 20000, transfer: 2000, word: 20 };

/** @param {number} w @param {number} b @returns {boolean} */
const icBit = (w, b) => Math.floor(w / 2 ** (29 - b)) % 2 === 1;

export class Dms2 {
  /**
   * @param {import("./dpr2.js").Dpr2} cpu
   * @param {Uint32Array} pack the pack's words, 30 bits each
   */
  constructor(cpu, pack) {
    this.cpu = cpu;
    this.pack = pack;
    this.cylinder = 0;
    /** @type {{ end: number; pivot: number } | null} the operation under way */
    this.busy = null;
    /** Whether IC bit 5 was set at the last poll: the controller starts on its rise. */
    this.started = false;
    /** Operations done, for the Processor tab. */
    this.operations = 0;
    cpu.setSense(SENSE_READY, true);
  }

  /** Starts an operation when IC bit 5 rises, and ends it when its time is up. */
  poll() {
    const cpu = this.cpu;
    const start = icBit(cpu.IC, IC_START);
    if (start && !this.started && !this.busy) this.begin();
    this.started = start;
    const b = this.busy;
    if (b && cpu.time >= b.end) {
      this.busy = null;
      cpu.setSense(SENSE_READY, true);
      cpu.request(DISK_CHANNEL, assembleOp("JPSR", b.pivot, { I: true }));
    }
  }

  /** Reads the command and does the operation; its end comes later. */
  begin() {
    const cpu = this.cpu;
    const core = cpu.core;
    const cw = core.read(COMMAND);
    const tw = core.read(TRANSFER);
    const op = hi(cw) & 0o7000;
    let us = TIME.transfer;
    let pivot = END_PIVOT;
    if (op === OP.HOME) {
      this.cylinder = 0;
      us = TIME.home;
      pivot = SEEK_PIVOT;
    } else if (op === OP.SEEK) {
      const n = lo(cw) >> 4;
      this.cylinder = Math.max(0, this.cylinder + (hi(cw) & 0o40000 ? -n : n));
      us = TIME.seek;
      pivot = SEEK_PIVOT;
    } else if (op === OP.READ) {
      const count = hi(tw) >> 2;
      let at = lo(tw);
      const from = lo(cw) * SECTOR_WORDS;
      for (let k = 0; k < count; k++) {
        at = (at + 1) & 0o77777;
        core.write(at, this.pack[from + k] ?? 0);
      }
      core.write(TRANSFER, word(hi(tw), at));
      us += count * TIME.word;
    }
    core.write(STATUS, 0);
    this.operations++;
    this.busy = { end: cpu.time + us, pivot };
    cpu.setSense(SENSE_READY, false);
  }
}
