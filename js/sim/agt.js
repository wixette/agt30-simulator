// SPDX-License-Identifier: Apache-2.0
//
// The AGT-30 as a whole: the display terminal (DSPLY, the array, the vector generator, the
// frame clock) with its DPR-2 processor running programs, the console's devices, the ASR-33
// Teletype and the AMOS monitor that listens to it.
//
// One processor does everything, as on the real machine (D4):
// - DSPLY's work each frame comes first (the display has the higher interrupt priority,
//   FJCC68 Fig. 17);
// - the CLOCK chain runs at the tick (DSPLY p. 10);
// - a foreground program started from the monitor gets the time that is left.
// A heavy picture therefore slows a running program, and a busy program never slows the
// picture.
//
// Every view reads this one object (D1). Inputs come in as calls: setDial, setKey, pen, type.

import { assemble } from "./adept.js";
import { TTY } from "./amoscode.js";
import { Dpr2 } from "./dpr2.js";
import { loadFigures } from "./figures.js";
import { CALL_AREA, Monitor } from "./amos.js";
import { Terminal } from "./terminal.js";
import { Teletype } from "./teletype.js";
import { word } from "./words.js";

/** The ASR-33 prints, and sends, 10 characters a second (SRM5 DPR3 p. 11). */
export const TTY_US_PER_CHAR = 100000;
/**
 * How fast the page's menus send statements: as fast as the monitor takes them, 1 ms a
 * character (U8). Their echo, and the monitor's replies to them, print at once; what the
 * machine types on its own (a program's output, BUMP's RATE) prints at 10 a second.
 */
export const FAST_US_PER_CHAR = 1000;
/** Where the resident programs are assembled at start (R15). */
export const RESIDENT_AT = 0o60000;
/** Where the operator's programs are assembled: above the pictures (R15). */
export const USER_AT = 0o40000;
/** A word the processor returns to when DSPLY's JSR item or the monitor calls a routine. */
export const RETURN_TRAP = 0o67776;
/** The longest a CLOCK routine or a JSR routine may run before it is given up, us. */
const ROUTINE_LIMIT_US = 20000;
/** The resident programs, assembled at start in this order (R15): files in programs/. */
export const RESIDENT = ["RVCD", "DIALS", "PENHT", "A", "CUBE", "TUND", "RAND"];
/** The function keys (FNS1), and the dials (VCD1). */
export const KEYS = 16;
export const DIALS = 6;
/** The light pen's field of view at the screen, inches: its aperture (est). */
export const PEN_APERTURE_IN = 0.15;

/**
 * A routine on the CLOCK chain: DPR-2 code from ROUTINE until EXIT (DSPLY p. 9).
 * @typedef {{ routine: number; exit: number }} ClockRoutine
 */

/** @typedef {Record<string, string>} Sources ADEPT source files by name (programs/NAME.adept) */

export class Agt30 extends Terminal {
  constructor() {
    super();
    /** The console's devices. */
    this.dev = {
      /** six variable control dials (VCD1), -1..1 */
      dials: new Float64Array(DIALS),
      /** sixteen function keys (FNS1) on S5, key n as bit n in Adage's numbering from the left */
      switches: 0,
      /** PULSE 1, the manual interrupt, held down; in v0.0.1 it requests no service (R10) */
      pulse1: false,
    };
    /** @type {number[]} characters typed on the keyboard and not yet read by a program (AMOS codes) */
    this.keys = [];
    /** The paper. */
    this.paper = new Teletype();
    /** @type {{ ch: string; at: number }[]} characters waiting to print, with when each starts */
    this.printQueue = [];
    /** When the printer is free again. */
    this.printFree = 0;
    /** Print at once, not at 10 characters a second: while a menu's fast typing is taken (U8). */
    this.printAtOnce = false;
    /** @type {{ ch: string; gapUs: number }[]} characters waiting to be sent from the keyboard, each with the time until the next */
    this.sending = [];
    this.sendNext = 0;
    this.cpu = new Dpr2(this.core, {
      type: (code) => {
        if (this.timeNow() < this.printFree) return false;
        this.print(code === 0o15 ? "\r\n" : (TTY[code] ?? ""));
        return true;
      },
      key: () => this.keys.shift() ?? null,
      switches: () => this.dev.switches,
      analog: (ch) => (ch < DIALS ? this.dev.dials[ch] : 0),
    });
    /** @type {ClockRoutine[]} DPR-2 routines on the CLOCK chain */
    this.clockCode = [];
    /** @type {{ until: number; name: string } | null} the foreground program: it runs until it returns to `until` */
    this.program = null;
    /** Processor time given to programs and the CLOCK chain, us. */
    this.programUs = 0;
    this.clockUs = 0;
    /** When the current run of the processor started, in simulated time and in processor time. */
    this.runBase = 0;
    this.runCpu = 0;
    /** @type {{ words: Uint32Array; symbols: Map<string, number> } | null} core as it was at start, for RESET! */
    this.startCore = null;
    this.monitor = new Monitor(this);
    this.typeout = (/** @type {string} */ text) => this.print(text);
    this.dsply.machine = (addr) => this.callRoutine(addr);
    this.dsply.pen.aperture = PEN_APERTURE_IN;
  }

  /**
   * A new AGT-30 as it starts (R15): the generated pictures and the resident programs in core,
   * the operator's source files in the monitor's store, the monitor listening.
   * @param {Sources} sources every file in programs/, by name
   * @returns {Agt30}
   */
  static boot(sources) {
    const agt = new Agt30();
    const end = loadFigures(agt);
    if (end > USER_AT) throw new Error(`the pictures run into the operator's area (${end.toString(8)})`);
    let at = RESIDENT_AT;
    for (const name of RESIDENT) {
      const src = sources[name];
      if (src === undefined) throw new Error(`no resident program ${name}`);
      const r = assemble(agt.core, src, at);
      if (r.errors.length) throw new Error(`${name}: ${r.errors.map((e) => `line ${e.line}: ${e.message}`).join("; ")}`);
      at = r.end;
    }
    if (at > CALL_AREA) throw new Error("the resident programs run into the monitor");
    for (const [name, src] of Object.entries(sources)) if (!RESIDENT.includes(name)) agt.monitor.files.set(name, src);
    agt.monitor.loadAt = USER_AT;
    agt.startCore = { words: agt.core.words.slice(), symbols: new Map(agt.core.symbols) };
    return agt;
  }

  /**
   * RESET! (AMRMX p. 11): "logically equivalent to that immediately after loading the Monitor":
   * the operator's programs and symbols are released, the display halts, and core, DSPLY and
   * the CLOCK chain are as they were at start (R9).
   */
  reset() {
    this.halt();
    this.stopProgram();
    this.clockCode = [];
    if (this.startCore) {
      this.core.words.set(this.startCore.words);
      this.core.symbols = new Map(this.startCore.symbols);
      this.core.version++;
    }
    this.rate = 2;
    this.errort = "ALL";
    this.dsply.reset();
    this.monitor.loadAt = USER_AT;
  }

  // ---- inputs (architecture §4) ----

  /**
   * Turns a dial.
   * @param {number} n 0-5
   * @param {number} value -1..1
   */
  setDial(n, value) {
    this.dev.dials[n] = Math.max(-1, Math.min(1, value));
  }

  /**
   * Presses or releases a function key. They are momentary: down while pressed.
   * @param {number} n 0-15
   * @param {boolean} down
   */
  setKey(n, down) {
    const bit = 2 ** (29 - n);
    const on = Math.floor(this.dev.switches / bit) % 2 === 1;
    if (on !== down) this.dev.switches += down ? bit : -bit;
  }

  /**
   * Whether a function key is down.
   * @param {number} n 0-15
   * @returns {boolean}
   */
  keyDown(n) {
    return Math.floor(this.dev.switches / 2 ** (29 - n)) % 2 === 1;
  }

  /**
   * Presses or releases PULSE 1. It is drawn and pressed as on the box, but no program of v0.0.1
   * uses it, so it requests no interrupt (R10).
   * @param {boolean} down
   */
  setPulse1(down) {
    this.dev.pulse1 = down;
  }

  /**
   * Points the light pen at the screen.
   * @param {number} x inches from the centre
   * @param {number} y
   * @param {boolean} pressed its fingertip switch
   */
  pen(x, y, pressed) {
    Object.assign(this.dsply.pen, { x, y, pressed });
  }

  /**
   * Types on the Teletype's keyboard. Characters go out at the ASR-33's 10 a second, each
   * reaching the monitor in its turn; the page's menus send faster (FAST_US_PER_CHAR, U8).
   * @param {string} text
   * @param {number} [usPerChar]
   */
  type(text, usPerChar = TTY_US_PER_CHAR) {
    for (const ch of text) this.sending.push({ ch, gapUs: usPerChar });
  }

  /** Whether characters are still waiting to be sent. */
  get typing() {
    return this.sending.length > 0;
  }

  /** Throws away what has not been sent yet. */
  cancelTyping() {
    this.sending = [];
  }

  /** Whether the keyboard or the printer is still busy. */
  get busy() {
    return this.sending.length > 0 || this.printQueue.length > 0;
  }

  // ---- the processor's time ----

  /**
   * The simulated time now, also while the processor runs between two calls of advance(): the
   * start of the run plus the processor time it has used.
   * @returns {number}
   */
  timeNow() {
    return this.runBase + (this.cpu.time - this.runCpu);
  }

  /**
   * Queues text for the printer, printed at 10 characters a second in simulated time.
   * @param {string} text
   */
  print(text) {
    for (const ch of text) {
      if (this.printAtOnce) {
        // the echo of a menu's fast typing, and the monitor's replies to it: at once, after
        // whatever is already waiting to print (U8)
        const at = Math.max(this.timeNow(), this.printQueue.at(-1)?.at ?? 0);
        this.printQueue.push({ ch, at });
        this.printFree = Math.max(this.printFree, at);
        continue;
      }
      const at = Math.max(this.timeNow(), this.printFree);
      this.printQueue.push({ ch, at });
      this.printFree = at + (ch === "\n" ? 0 : TTY_US_PER_CHAR);
    }
  }

  /**
   * One character reaches the computer from the keyboard. The monitor always listens (it runs
   * in the background, AMRMX p. 1); a running program may also read it (OPTI).
   * @param {string} ch
   */
  key(ch) {
    if (this.program) {
      const code = TTY.indexOf(ch.toUpperCase());
      this.keys.push(code < 0 ? 0 : code);
      if (this.keys.length > 64) this.keys.shift();
    }
    this.monitor.input(ch);
  }

  /** @param {number} until */
  advance(until) {
    if (!this.sending.length) this.sendNext = Math.max(this.sendNext, this.now);
    while (this.sending.length && this.sendNext <= until) {
      this.advanceTo(Math.max(this.sendNext, this.now));
      const c = /** @type {{ ch: string; gapUs: number }} */ (this.sending.shift());
      this.printAtOnce = c.gapUs < TTY_US_PER_CHAR;
      this.key(c.ch);
      this.printAtOnce = false;
      this.sendNext += c.gapUs;
    }
    this.advanceTo(until);
  }

  /** @param {number} until */
  advanceTo(until) {
    // with the display halted, the foreground program has the processor to itself
    if (this.image === null && this.program) {
      this.runBase = this.now;
      this.runCpu = this.cpu.time;
      this.runProgram(until - this.now);
    }
    super.advance(until);
    while (this.printQueue.length && this.printQueue[0].at <= until) {
      const c = /** @type {{ ch: string }} */ (this.printQueue.shift());
      this.paper.writeText(c.ch);
    }
  }

  /**
   * Runs a DPR-2 routine as JPSR would enter it, saving and restoring the registers of
   * whatever the processor was doing: for DSPLY's JSR items (D4).
   * @param {number} addr the routine's entry: the word that takes the return address
   * @returns {number | null} its time in us, or null if it did not return
   */
  callRoutine(addr) {
    const cpu = this.cpu;
    const saved = { AR: cpu.AR, BR: cpu.BR, IC: cpu.IC, ER: cpu.ER, LC: cpu.LC };
    this.core.write(addr, word(0, RETURN_TRAP));
    cpu.pri.hold = true;
    const r = cpu.run((addr + 1) & 0o77777, RETURN_TRAP, ROUTINE_LIMIT_US);
    cpu.pri.hold = false;
    Object.assign(cpu, saved);
    return r.done && !cpu.stopped ? r.us : null;
  }

  runClock() {
    const start = this.nextTick;
    this.runBase = start;
    this.runCpu = this.cpu.time;
    // the CLOCK chain's routines, at the tick; the registers are saved and restored (p. 10)
    const cpu = this.cpu;
    cpu.pri.hold = true;
    for (const c of this.clockCode) {
      const saved = { AR: cpu.AR, BR: cpu.BR, IC: cpu.IC, ER: cpu.ER, LC: cpu.LC };
      const r = cpu.run(c.routine, c.exit, ROUTINE_LIMIT_US);
      this.clockUs += r.us;
      if (!r.done) this.print(`CLOCK ROUTINE AT ${c.routine.toString(8)} DID NOT RETURN\r\n`);
      Object.assign(cpu, saved);
    }
    cpu.pri.hold = false;
  }

  runFrame() {
    const start = this.nextTick;
    super.runFrame();
    const last = this.frames.at(-1);
    if (last && last.start === start && this.program) {
      // the time to the next tick, less DSPLY's
      const free = Math.max(0, this.nextTick - start - last.cpu);
      this.runBase = start + last.cpu;
      this.runCpu = this.cpu.time;
      this.runProgram(free);
    }
  }

  /**
   * Gives the foreground program some processor time.
   * @param {number} us
   */
  runProgram(us) {
    if (!this.program || us <= 0) return;
    const r = this.cpu.resume(this.program.until, us);
    this.programUs += r.us;
    if (r.done) {
      if (this.cpu.stopped) this.print(`${this.cpu.stopped.toUpperCase()}\r\n`);
      this.program = null;
    }
  }

  /**
   * Starts a foreground program at an address: it runs until it jumps to `until`.
   * @param {number} addr
   * @param {number} until
   * @param {string} name
   */
  startProgram(addr, until, name) {
    this.cpu.LC = addr;
    this.program = { until, name };
  }

  /** STOP!: suspends the foreground program. */
  stopProgram() {
    this.program = null;
    this.cpu.pri.service = [];
  }
}
