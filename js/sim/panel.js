// SPDX-License-Identifier: Apache-2.0
//
// The DPR-2's operator's control panel, OCP (SRM5 DPR3 pp. 12-14; docs/agt30-overview.md §7;
// R21). Its lamps and switches, and what each control does to the simulated machine:
// - BR: 30 lamps showing the buffer register, each also a button that sets its bit; RESET BR
//   clears the register.
// - PRI: 30 toggles holding one instruction, served on channel 1 when PULSE 1 is pressed with
//   the request selector at PULSE 1 (HUB 1 and HUB 2 hand the switches to outside devices, of
//   which the AGT-30 has none). The usual setting is 24000 77776, MDIR 77776 (MH26).
// - RUN, HALT, PAUSE: whether the processor runs, is stopped, or obeys only PRI instructions.
//   STEP obeys one instruction while it is stopped; CYCLE, one machine cycle, which the simulator
//   (being at instruction level) takes as one instruction.
// - RESET puts the processor in a known state and halts it; OFF (both buttons) and ON.
// - BTSP enters or leaves bootstrap mode; TE, the Teletype's error lamp; IC 0 and IC 1.
//
// The monitor of this version is JavaScript (amos.js), not code in core, so what "the processor
// runs" means here is: the display's frames, the CLOCK chain, a foreground program, and the
// monitor answering the Teletype. HALT stops all of them; RUN lets them go on (R21).

import { word } from "./words.js";

/** PULSE 1's channel (DPR2BD; R10). */
export const PULSE1_CHANNEL = 1;
/** PULSE 1's pivot: where the usual PRI setting, MDIR 77776, finds its instruction (MH26; R10). */
export const PULSE1_PIVOT = 0o77776;
/**
 * Where the word at the pivot jumps to: the way back into the monitor. A trap of ours, since our
 * monitor is not in core (R21); the processor stops there and the monitor takes over.
 */
export const MONITOR_ENTRY = 0o67775;
/** The PRI switches' usual setting: 24000 77776, MDIR 77776 (MH26). */
export const PRI_USUAL = word(0o24000, 0o77776);
/** The request selector's positions (SRM5 DPR3 p. 13). */
export const SELECTOR = /** @type {const} */ (["pulse1", "hub1", "hub2"]);
/** The machine's buttons along the bottom, in groups as on the panel (figure 7). */
export const BUTTONS = [["off0", "on", "reset"], ["step", "cycle"], ["halt", "run", "pause"], ["btsp", "te"], ["ic0", "ic1"]];
/** Every named control: those buttons, and RESET BR, PULSE 1 and the second OFF on the right. */
export const CONTROLS = [...BUTTONS.flat(), "resetbr", "pulse1", "off1"];
/** The buttons that are also lamps: the lamp each shows, as lamps() names it. */
export const LAMPED = /** @type {Record<string, string>} */ ({ on: "power", run: "run", halt: "halt", pause: "pause", btsp: "btsp", te: "te", ic0: "ic0", ic1: "ic1", pulse1: "pulse1" });
/** How long one OFF button waits for the other, ms of wall time. */
export const OFF_TOGETHER_MS = 2000;

/** @typedef {"run" | "halt" | "pause"} Mode */
/** @typedef {typeof SELECTOR[number]} Selector */
/**
 * What a control did, for the page to say. "ok" is plain success; the others name a case.
 * @typedef {"ok" | "off" | "halted" | "served" | "waiting" | "hub" | "nothing" | "stepped" | "ended" | "monitor" | "armed" | "started"} Outcome
 */

/** @typedef {import("./agt.js").Agt30} Agt30 */

/** @param {number} w @param {number} bit 0-29 from the left @returns {boolean} */
export const bitOf = (w, bit) => Math.floor(w / 2 ** (29 - bit)) % 2 === 1;
/** @param {number} w @param {number} bit @param {boolean} on @returns {number} */
const withBit = (w, bit, on) => (bitOf(w, bit) === on ? w : w + (on ? 1 : -1) * 2 ** (29 - bit));

export class Panel {
  /** @param {Agt30} agt */
  constructor(agt) {
    this.agt = agt;
    this.power = true;
    /** @type {Mode} */
    this.mode = "run";
    /** The PRI toggles, as a word. */
    this.pri = PRI_USUAL;
    /** @type {Selector} */
    this.selector = "pulse1";
    this.btsp = false;
    /** When the first OFF was pressed (performance time), and which, or null. */
    /** @type {{ which: number; at: number } | null} */
    this.offArmed = null;
  }

  /** Whether the processor runs: powered, and neither halted nor paused. */
  get running() {
    return this.power && this.mode === "run";
  }

  /** Whether PULSE 1's request is waiting: its lamp. */
  get pulse1Lit() {
    return this.power && this.agt.cpu.pri.pending.has(PULSE1_CHANNEL);
  }

  /** The lamps besides BR's: lit or not. */
  lamps() {
    const cpu = this.agt.cpu;
    const on = this.power;
    return {
      power: on,
      run: on && this.mode === "run",
      halt: on && this.mode === "halt",
      pause: on && this.mode === "pause",
      btsp: on && this.btsp,
      // the simulator serves the Teletype directly, so it never interrupts twice unserved
      te: false,
      ic0: on && bitOf(cpu.IC, 0),
      ic1: on && bitOf(cpu.IC, 1),
      pulse1: this.pulse1Lit,
    };
  }

  /** BR's lamps: dark with the power off. */
  get br() {
    return this.power ? this.agt.cpu.BR : 0;
  }

  /** Applies the mode to the machine: the frame loop holds while the processor does not run. */
  sync() {
    const agt = this.agt;
    const held = !this.running;
    if (agt.held && !held) {
      // going again: from the next tick on, not every tick missed while stopped
      agt.nextTick = agt.nextTickAfter(agt.now);
      agt.sendNext = Math.max(agt.sendNext, agt.now);
    }
    agt.held = held;
  }

  // ---- BR and the PRI switches ----

  /** @param {number} bit 0-29 @returns {Outcome} */
  pressBR(bit) {
    if (!this.power) return "off";
    this.agt.cpu.BR = withBit(this.agt.cpu.BR, bit, true);
    return "ok";
  }

  /** @returns {Outcome} */
  resetBR() {
    if (!this.power) return "off";
    this.agt.cpu.BR = 0;
    return "ok";
  }

  /** @param {number} bit 0-29 */
  togglePri(bit) {
    this.pri = withBit(this.pri, bit, !bitOf(this.pri, bit));
  }

  /** @param {number} w */
  setPri(w) {
    this.pri = w;
  }

  /** Turns the request selector to its next position. */
  turnSelector() {
    this.selector = SELECTOR[(SELECTOR.indexOf(this.selector) + 1) % SELECTOR.length];
  }

  // ---- PULSE 1 ----

  /**
   * PULSE 1: with the selector at PULSE 1, a request on channel 1 with the PRI switches'
   * instruction. It is served at once unless the processor is halted, or interrupts are frozen
   * or busy with a higher channel; then its lamp stays lit until it is.
   * @returns {Outcome}
   */
  pulse1() {
    if (!this.power) return "off";
    if (this.selector !== "pulse1") return "hub";
    this.agt.cpu.request(PULSE1_CHANNEL, this.pri);
    return this.servePending();
  }

  /**
   * Serves PULSE 1's request now if the processor may: it is not halted, and nothing of the same
   * or higher priority holds it off.
   * @returns {Outcome}
   */
  servePending() {
    const agt = this.agt;
    const cpu = agt.cpu;
    if (this.mode === "halt") return cpu.pri.pending.has(PULSE1_CHANNEL) ? "halted" : "nothing";
    if (cpu.nextRequest() !== PULSE1_CHANNEL) return cpu.pri.pending.has(PULSE1_CHANNEL) ? "waiting" : "nothing";
    const lc = cpu.LC;
    cpu.servePri(PULSE1_CHANNEL);
    return this.after(lc);
  }

  /**
   * After an instruction from the panel: back to the monitor if it led to the monitor's entry; a
   * program started if it jumped somewhere else while none ran.
   * @param {number} lc LC before it
   * @returns {Outcome}
   */
  after(lc) {
    const agt = this.agt;
    const cpu = agt.cpu;
    if (cpu.LC === MONITOR_ENTRY) {
      agt.abort();
      cpu.LC = lc;
      return "monitor";
    }
    if (cpu.LC !== lc && !agt.program) {
      agt.startProgram(cpu.LC, MONITOR_ENTRY, "PANEL");
      return "started";
    }
    return "served";
  }

  // ---- RUN, HALT, PAUSE, STEP, CYCLE ----

  /** @returns {Outcome} */
  run() {
    if (!this.power) return "off";
    this.mode = "run";
    this.sync();
    this.servePending();
    return "ok";
  }

  /** @returns {Outcome} */
  halt() {
    if (!this.power) return "off";
    this.mode = "halt";
    this.sync();
    return "ok";
  }

  /** @returns {Outcome} */
  pause() {
    if (!this.power) return "off";
    this.mode = "pause";
    this.sync();
    this.servePending();
    return "ok";
  }

  /**
   * One instruction while the processor is stopped: a waiting PRI request first, as the hardware
   * serves it before the next fetch, else the program's next instruction.
   * @returns {Outcome}
   */
  step() {
    if (!this.power) return "off";
    if (this.mode === "run") return "nothing";
    const agt = this.agt;
    const cpu = agt.cpu;
    if (cpu.nextRequest() === PULSE1_CHANNEL) {
      const lc = cpu.LC;
      cpu.servePri(PULSE1_CHANNEL);
      return this.after(lc);
    }
    if (!agt.program) return "nothing";
    cpu.stopped = null;
    const us = cpu.step();
    agt.programUs += us;
    if (cpu.LC === MONITOR_ENTRY && agt.program.until !== MONITOR_ENTRY) {
      agt.abort();
      return "monitor";
    }
    const stopped = /** @type {string | null} */ (cpu.stopped);
    if (cpu.LC === agt.program.until || stopped) {
      if (stopped) agt.print(`${stopped.toUpperCase()}\r\n`);
      agt.program = null;
      return "ended";
    }
    return "stepped";
  }

  /** CYCLE: one machine cycle; at instruction level, one instruction (R21). @returns {Outcome} */
  cycle() {
    return this.step();
  }

  // ---- RESET, power, BTSP, IC ----

  /**
   * RESET: the processor's registers cleared, its interrupts cleared, and halted. The program and
   * the display stop; core is kept (R21).
   * @returns {Outcome}
   */
  reset() {
    if (!this.power) return "off";
    this.clear();
    this.mode = "halt";
    this.sync();
    return "ok";
  }

  /** The registers and interrupts as after RESET or power-up; the program and display stopped. */
  clear() {
    const agt = this.agt;
    const cpu = agt.cpu;
    Object.assign(cpu, { AR: 0, BR: 0, IC: 0, ER: 0, LC: 0, S4: 0 });
    cpu.pri.pending.clear();
    cpu.pri.service = [];
    cpu.pri.frozen = false;
    agt.stopProgram();
    agt.halt();
    this.btsp = false;
  }

  /**
   * One of the two OFF buttons. Power goes off only when both are pressed together: here, the
   * other within OFF_TOGETHER_MS.
   * @param {0 | 1} which
   * @param {number} [now] performance time, ms
   * @returns {Outcome}
   */
  off(which, now = performance.now()) {
    if (!this.power) return "off";
    const armed = this.offArmed;
    if (armed && armed.which !== which && now - armed.at <= OFF_TOGETHER_MS) {
      this.offArmed = null;
      this.clear();
      this.power = false;
      this.mode = "halt";
      this.sync();
      return "ok";
    }
    this.offArmed = { which, at: now };
    return "armed";
  }

  /** ON: power, and the processor stops in HALT; core still holds what it held. @returns {Outcome} */
  on() {
    if (this.power) return "ok";
    this.power = true;
    this.mode = "halt";
    this.sync();
    return "halted";
  }

  /**
   * BTSP: enters bootstrap mode (PAUSE, IC bit 28 set) or leaves it. No bootstrap tape is
   * fitted yet, so nothing is read (R21).
   * @returns {Outcome}
   */
  bootstrap() {
    if (!this.power) return "off";
    const cpu = this.agt.cpu;
    this.btsp = !this.btsp;
    cpu.IC = withBit(cpu.IC, 28, this.btsp);
    if (this.btsp) {
      this.mode = "pause";
      this.sync();
    }
    return "ok";
  }

  /** IC 0, IC 1: shows and sets two bits of IC. @param {0 | 1} bit @returns {Outcome} */
  toggleIC(bit) {
    if (!this.power) return "off";
    const cpu = this.agt.cpu;
    cpu.IC = withBit(cpu.IC, bit, !bitOf(cpu.IC, bit));
    return "ok";
  }
}
