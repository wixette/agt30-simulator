// SPDX-License-Identifier: Apache-2.0
//
// The real monitor: the AGT-30 run as the bare machine, with AMRMX booted from NCSU's system
// pack (M. Howard's dump, MH25) in place of the simulator's own JavaScript monitor and DSPLY.
// The processor runs all the time, as it did; the vector generator, the Teletype's line and the
// disk are modeled at register level (avg1.js R22, ttyline.js R23, dms2.js R24), and every
// picture and every character is AMRMX's own doing.
//
// The bootstrap is ours (R24): it puts the resident monitor in core as AMLD0, NCSU's monitor
// loader, leaves it (the pack's cylinder 2 at 73400, the start of cylinder 3 at 76600), and
// enters it at 73400 with BR as the operator's buttons left it. AMLD0 itself is not copied.

import { Avg1 } from "./avg1.js";
import { CYLINDER_SECTORS, Dms2, SECTOR_WORDS } from "./dms2.js";
import { TtyLine } from "./ttyline.js";

/** The pack's size in words: 61.5 cylinders of 1,664 (research/amrmx.md). */
export const PACK_WORDS = 102336;
/** Where AMLD0 puts the resident monitor and enters it (MH25; research/amrmx.md). */
export const MONITOR_START = 0o73400;
export const MONITOR_HIGH = 0o76600;
const CYLINDER_WORDS = SECTOR_WORDS * CYLINDER_SECTORS;
/** Words read from the start of cylinder 3, to 77677. */
const HIGH_WORDS = 0o77700 - MONITOR_HIGH;
/** Where AMRMX's commands continue after a program returns: MON9, its main loop (research/amrmx.md). */
export const MONITOR_RETURN = 0o76377;
/** LIFE on the pack: volume 10 (cylinder 34), origin 90 (research/ncsu-tapes.md). */
export const LIFE_SECTOR = 34 * CYLINDER_SECTORS + 90;
/** A dump's first record is its descriptor (two words at 70730, and the name and bounds at 70732), not core to load. */
const DESCRIPTOR = [0o70730, 0o70732];

/**
 * A DUMP file's records, as AMRMX writes a core image to the pack: each a word with the address
 * in its upper half and the count in its lower, then that many words; a zero word ends the file.
 * @param {Uint32Array} pack
 * @param {number} sector where the file starts
 * @returns {{ addr: number; words: Uint32Array }[]}
 */
export function dumpRecords(pack, sector) {
  const out = [];
  for (let p = sector * SECTOR_WORDS; p < pack.length; ) {
    const h = pack[p];
    const count = h & 0o77777;
    if (count === 0 || count > 0o1000) break;
    out.push({ addr: Math.floor(h / 0o100000) & 0o77777, words: pack.slice(p + 1, p + 1 + count) });
    p += 1 + count;
  }
  return out;
}

/** How long a frame record covers, us: for the views that count frames. */
const FRAME_US = 25000;
/** Steps given at most to one call of advance(): a stopped clock cannot hang the page. */
const MAX_STEPS = 2_000_000;

/**
 * The pack's image as the dump stores it: each word in four bytes, low byte first.
 * @param {ArrayBuffer} buf
 * @returns {Uint32Array} 30-bit words
 */
export function readPack(buf) {
  if (buf.byteLength !== PACK_WORDS * 4) throw new Error(`a pack image is ${PACK_WORDS * 4} bytes, not ${buf.byteLength}`);
  const v = new DataView(buf);
  const w = new Uint32Array(PACK_WORDS);
  for (let i = 0; i < PACK_WORDS; i++) w[i] = v.getUint32(i * 4, true) & 0x3fffffff;
  return w;
}

/**
 * The bootstrap (ours, R24): the resident monitor into core, as AMLD0 leaves it.
 * @param {import("./image.js").Core} core
 * @param {Uint32Array} pack
 */
export function loadMonitor(core, pack) {
  for (let i = 0; i < CYLINDER_WORDS; i++) core.write(MONITOR_START + i, pack[2 * CYLINDER_WORDS + i]);
  for (let i = 0; i < HIGH_WORDS; i++) core.write(MONITOR_HIGH + i, pack[3 * CYLINDER_WORDS + i]);
}

export class Bare {
  /**
   * Boots AMRMX on a machine: its display and programs stop, the monitor is loaded and entered.
   * @param {import("./agt.js").Agt30} agt
   * @param {Uint32Array} pack
   */
  constructor(agt, pack) {
    this.agt = agt;
    const cpu = agt.cpu;
    this.avg = new Avg1(cpu, agt.array);
    this.avg.clear();
    this.line = new TtyLine(cpu, (code) => this.printed(code));
    // a copy: AMRMX writes to its pack, and the pack fetched stays as it came
    this.disk = new Dms2(cpu, pack.slice());
    cpu.devices.write = (d, v, l) => this.avg.write(d, v, l);
    cpu.devices.strobe = (b) => this.line.strobe(b);
    /** Simulated time less the processor's: it grows while the processor is stopped. */
    this.off = agt.now - cpu.time;
    this.frameStart = agt.now;
    this.frameVectors = 0;
    this.frameDrawn = 0;
    this.pack = pack;
    this.boot();
  }

  /**
   * The bootstrap: the monitor loaded from the pack and entered at its start, BR as the
   * operator left it, the interrupts clear, the processor's clock on (R24).
   */
  boot() {
    const cpu = this.agt.cpu;
    loadMonitor(this.agt.core, this.pack);
    cpu.LC = MONITOR_START;
    cpu.IC = 0;
    cpu.pri.pending.clear();
    cpu.pri.service = [];
    cpu.pri.frozen = false;
    cpu.stopped = null;
    this.avg.clear();
  }

  /**
   * Loads a program's core image from the pack and starts it, as AMRMX's START would (ours, R24):
   * every record but the descriptor into core, the program's entry word given the return to the
   * monitor, and the processor on at the word after it. For LIFE until AMRMX takes its commands.
   * @param {number} sector the DUMP file's first sector
   * @param {number} entry the program's entry word, a JPSR target (LIFE's is 120)
   * @returns {number} the records loaded
   */
  startDump(sector, entry) {
    const cpu = this.agt.cpu;
    const core = this.agt.core;
    const recs = dumpRecords(this.disk.pack, sector).filter((r) => !DESCRIPTOR.includes(r.addr));
    for (const r of recs) r.words.forEach((w, k) => core.write((r.addr + k) & 0o77777, w));
    core.write(entry, (Math.floor(core.read(entry) / 0o100000) & 0o77777) * 0o100000 + MONITOR_RETURN);
    cpu.LC = (entry + 1) & 0o77777;
    cpu.pri.pending.clear();
    cpu.pri.service = [];
    cpu.pri.frozen = false;
    return recs.length;
  }

  /**
   * A character the Teletype received from the computer: printed at once, the line having paced it.
   * @param {number} code 8 bits
   */
  printed(code) {
    const c = code & 0o177;
    if (c === 0o15) this.agt.paper.writeText("\r");
    else if (c === 0o12) this.agt.paper.writeText("\n");
    else if (c >= 0o40 && c < 0o177) this.agt.paper.writeText(String.fromCharCode(c));
  }

  /**
   * Keys pressed on the Teletype: sent on the line at its pace, upper case.
   * @param {string} text
   */
  type(text) {
    for (const ch of text.toUpperCase()) {
      if (ch === "\n") continue;
      this.line.key(ch === "\r" ? 0o15 : ch.charCodeAt(0));
      // the Teletype at half duplex prints its own keys: AMRMX does not echo them (R23)
      if (ch === "\r") this.agt.paper.writeText("\r\n");
      else if (ch >= " " && ch < "\x7f") this.agt.paper.writeText(ch);
    }
  }

  /** Polls the devices and obeys one instruction. @returns {number} us */
  step() {
    const cpu = this.agt.cpu;
    this.avg.poll();
    this.line.poll();
    this.disk.poll();
    cpu.stopped = null;
    return cpu.step();
  }

  /**
   * Runs the machine to a simulated time: the processor while the panel lets it run.
   * @param {number} until
   */
  advance(until) {
    const agt = this.agt;
    const cpu = agt.cpu;
    if (agt.panel.running) {
      const target = until - this.off;
      for (let n = 0; cpu.time < target && n < MAX_STEPS; n++) {
        this.step();
        if (cpu.stopped) {
          agt.panel.halt();
          agt.print(`${cpu.stopped.toUpperCase()}\r\n`);
          break;
        }
      }
      // stopped early (a halt, or too many steps): the time left passes without the processor
      if (cpu.time < target) this.off += target - cpu.time;
    } else {
      this.off += until - agt.now;
    }
    for (const s of this.avg.take()) {
      agt.segs.push({ ...s, t0: s.t0 + this.off, t1: s.t1 + this.off });
      this.frameVectors++;
      if (s.vis) this.frameDrawn++;
    }
    while (until - this.frameStart >= FRAME_US) {
      agt.frames.push({ start: this.frameStart, end: this.frameStart + FRAME_US, vectors: this.frameVectors, drawn: this.frameDrawn, items: 0, cpu: FRAME_US, cut: false, late: false, rate: agt.rate });
      if (agt.frames.length > 240) agt.frames.shift();
      this.frameStart += FRAME_US;
      this.frameVectors = this.frameDrawn = 0;
    }
  }
}
