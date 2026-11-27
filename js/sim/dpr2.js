// SPDX-License-Identifier: Apache-2.0
//
// The DPR-2 processor at instruction level.
//
// As Adage's DPR2 Subsystem Programming Instructions describe it (DPR2SPI; research/dpr2-manual.md),
// with times from SRM5 DPR3: 30-bit one's-complement words; a 2 us memory cycle; a transfer bus
// from 8 sources to 16 destinations that can AND, OR and complement and rotate left by 1, 6 or 15
// bits on the way; instructions named source-then-destination (MDAR loads AR from memory, ARMD
// stores it, MDAS and MDAE add to AR, MDXO exclusive-ors); the instruction layout and codes
// (DPR2SPI pp. 20, 36; ADEPT71 p. 41), which the NCSU tapes' binaries bear out (MH25;
// research/dpr2-encodings.md); indirect chains and pre-incrementing indexes (pp. 32-34); the
// conditional jumps and transfers (pp. 37-38); the EAU's multiply, divide and shifts (pp. 43-46).
// ENCODING and OPS below hold the layout and codes, in one place (D5). How the Teletype is
// driven is still ours (R9), and so is the pivot of the program interrupt (R10).

import { Core } from "./image.js";
import { hi, lo, M15, M30, word } from "./words.js";

/** @typedef {readonly [number, number]} Field bits from..to */

/**
 * The instruction layout (bit 0 is the leftmost of 30), as the NCSU tapes show it.
 * @type {Record<"kind" | "destination" | "source" | "rotate" | "logic" | "op" | "index" | "indirect", Field>}
 */
export const ENCODING = {
  /** bits 0-1: one of KIND */
  kind: [0, 1],
  destination: [2, 5],
  source: [6, 8],
  /** 0 none, 1 'B (1 bit), 2 'K (6 bits), 3 'H (15 bits): left rotation on the bus */
  rotate: [9, 10],
  /** 0 plain, 1 'O (OR into the destination), 2 'A (AND), 3 'N (complement) */
  logic: [11, 12],
  /** not a transfer: bits 0-12 together name the operation (OPS) */
  op: [0, 12],
  /** 'X: increment the lower half of the word about to be read (DPR2SPI pp. 32-33) */
  index: [13, 13],
  /** 'I: indirect (bit 14, as an image item's address mode I is the same bit) */
  indirect: [14, 14],
};

/**
 * The kinds of instruction, bits 0-1 (DPR2SPI p. 20, "M"): a special instruction; a transfer
 * whose operand is the word at the address; 'L, the next word; 'F, no memory cycle: the operand
 * is MD as fetched, the instruction itself (p. 30).
 */
export const KIND = { OTHER: 0, MEMORY: 1, NEXT: 2, IMMEDIATE: 3 };

/** Sources on the transfer bus, octal (DPR2SPI p. 20). S4 is the sense lines; S5 holds the function switches [0-14] and the converter ADC5 [15-29] (DPR2BD). */
export const SOURCES = { MD: 0, AR: 1, BR: 2, IC: 3, S4: 4, S5: 5, S6: 6, S7: 7 };
/**
 * Destinations, octal (DPR2SPI p. 20). 05-14 go to the subsystems (DPR2BD): XY is D5, the
 * array's X and Y data; MX is D7, GDD1, which selects the array's analog input and starts a
 * conversion (DPR2SPI p. 41; R7).
 */
export const DESTS = { MD: 0, AR: 1, BR: 2, IC: 3, IR: 4, XY: 5, MX: 7, AS: 0o15, AE: 0o16, XO: 0o17 };

/**
 * The special instructions, by their upper half with 'X and 'I clear (DPR2SPI p. 36, Figure 6;
 * ADEPT71 pp. 41-42). The tripp tape's binaries show the same codes.
 * @type {Record<string, number>}
 */
export const OPS = {
  NOOP: 0, JPSR: 0o20, JUMP: 0o40, JSAN: 0o60, JPAN: 0o100, JSLS: 0o120, JPLS: 0o140, OPTY: 0o160,
  OPCR: 0o200, SKUA: 0o220, SKLA: 0o240, CNVT: 0o320, UPRI: 0o340, FPRI: 0o360, OPTI: 0o460, PINT: 0o560,
  OPIO: 0o600, MPYU: 0o15400, MPYL: 0o15420, MPYI: 0o15440, DIVU: 0o16400, DIVL: 0o16420, DIVI: 0o16440,
  ARRS: 0o17440, ARLS: 0o17500, NORM: 0o17520, ERAR: 0o17540,
};
/**
 * Other names for the same codes, which the assembler takes: PULSE, as the NCSU sources name
 * OPCR's code; GI15, as ADEPT71 p. 41 names CNVT's.
 * @type {Record<string, string>}
 */
export const ALIASES = { PULSE: "OPCR", GI15: "CNVT" };
/**
 * The conditional transfers, ANDD and LSDD (C13, C14; DPR2SPI pp. 36-38): the destination in
 * bits 2-5, the condition in bits 6-10, and 'O, 'A, 'N, 'X and 'I as in a transfer. If AR is
 * negative (AN: AR[0] is 1) or has lower significance (LS: AR[15-29] is not +0), the word at the
 * address goes to the destination, unrotated.
 * @type {Record<string, number>}
 */
export const CONDITIONS = { AN: 0o260, LS: 0o300 };
/** @type {Map<number, string>} */
const OP_NAMES = new Map(Object.entries(OPS).map(([k, v]) => [v, k]));

/**
 * The name of an instruction that is not a transfer, or undefined.
 * @param {number} ins
 * @returns {string | undefined}
 */
export const opName = (ins) => OP_NAMES.get(get(ins, ENCODING.op) * 4);

/**
 * The condition of a conditional transfer, or undefined.
 * @param {number} ins
 * @returns {string | undefined}
 */
const conditionOf = (ins) => {
  const c = (get(ins, ENCODING.op) * 4) & 0o760;
  return Object.keys(CONDITIONS).find((k) => CONDITIONS[k] === c);
};

/** Times in microseconds (SRM5 DPR3 pp. 4-6, 10). */
export const TIME = { memory: 4, immediate: 3, jump: 3, jpsr: 5, skip: 3, opio: 6, indirect: 2, mul: 6, div: 8, shift: 5 };

/** Sense line bits (S4), numbered from the left. Bit 0: AR overflow (FJCC68 Fig. 17 channel 0); bit 29: ADC5 overflow (DPR2BD). */
export const SENSE = { OVERFLOW: 0, ADC: 29 };

/**
 * The longest chain of instructions sent to IR one after another that one step runs. The real
 * processor has no limit: LIFE runs its whole 128 x 128 board as one chain each generation.
 */
const IR_CHAIN = 1 << 20;

/** The priority channels the processor itself requests (DPR2BD): 14, the program interrupt (PINT). */
export const CHANNEL = { PINT: 14 };
/**
 * The program interrupt's pivot, PIPVT (DPR2SPI p. 40): 77743, where AMRMX on NCSU's pack puts its
 * task dispatcher and through which it runs PINT (research/amrmx.md; R10).
 */
export const PIPVT = 0o77743;

/**
 * Places a field's value into a word.
 * @param {number} w
 * @param {Field} field
 * @param {number} v
 * @returns {number}
 */
export function put(w, field, v) {
  const [from, to] = field;
  const width = to - from + 1;
  const shift = 2 ** (29 - to);
  const old = Math.floor(w / shift) % 2 ** width;
  return w + (v - old) * shift;
}

/**
 * A field's value.
 * @param {number} w
 * @param {Field} field
 * @returns {number}
 */
export function get(w, field) {
  const [from, to] = field;
  return Math.floor(w / 2 ** (29 - to)) % 2 ** (to - from + 1);
}

/**
 * Adds in one's complement with end-around carry.
 * @param {number} a
 * @param {number} b
 * @param {number} bits 15 or 30
 * @returns {{ sum: number; overflow: boolean }}
 */
export function onesAdd(a, b, bits) {
  const mod = 2 ** bits;
  const sign = mod / 2;
  let s = a + b;
  if (s >= mod) s = s - mod + 1;
  const overflow = (a >= sign) === (b >= sign) && (s >= sign) !== (a >= sign);
  return { sum: s, overflow };
}

/**
 * Rotates a 30-bit word left.
 * @param {number} w
 * @param {number} n
 * @returns {number}
 */
export function rotl(w, n) {
  const k = 2 ** n;
  const top = Math.floor(w / 2 ** (30 - n));
  return (w * k) % 2 ** 30 + top;
}

/** @param {number} w @returns {number} the signed value of a 30-bit one's-complement word */
const sval = (w) => (w >= 0o4000000000 ? -(M30 - w) : w);
/** @param {number} n @returns {number} a signed value as a 30-bit word */
const wval = (n) => (n >= 0 ? n % 0o4000000000 : M30 - (-n % 0o4000000000));

/**
 * The devices the processor can reach: the Teletype, the function switches, the dials through
 * the array's input selector and converter.
 * @typedef {object} Devices
 * @property {(code: number) => boolean} type types a 6-bit AMOS character; false while the Teletype is busy
 * @property {() => number} switches the function switches (S5): key n is bit n
 * @property {(channel: number) => number} analog an analog input, -1..1 (dials, joystick)
 * @property {(bit: number) => void} [strobe] OPTY's bit, BR[22], to the Teletype's line, when it is modeled
 * @property {(dst: number, v: number, logic: number) => boolean} [write] a transfer to a subsystem's destination (05-14): the word after rotation and 'N, and the logic, 1 'O or 2 'A, for the subsystem to apply; true if a subsystem took it
 */

/** @type {Devices} */
const NO_DEVICES = { type: () => true, switches: () => 0, analog: () => 0 };

export class Dpr2 {
  /**
   * @param {Core} core
   * @param {Devices} [devices]
   */
  constructor(core, devices = NO_DEVICES) {
    this.core = core;
    this.devices = devices;
    this.AR = 0;
    this.BR = 0;
    this.IC = 0;
    this.ER = 0;
    this.LC = 0;
    /** The address of the last instruction fetched from memory: for the Processor tab, since LC is restored around the CLOCK chain. */
    this.last = 0;
    /** Sense lines S4. */
    this.S4 = 0;
    /** The analog input GDD1 selects (destination MX), and ADC5's last conversion, S5[15-29]. */
    this.mux = 0;
    this.adc = 0;
    this.time = 0;
    this.instructions = 0;
    /** @type {string | null} why the processor stopped */
    this.stopped = null;
    /** @type {number | null} a word sent to IR, to be executed next (execute()) */
    this.irNext = null;
    /** An address that ends a run as `until` does, or -1: where PULSE 1's pivot leads back to the monitor. */
    this.breakAt = -1;
    /**
     * The priority interrupt (PRI) subsystem (SRM5 DPR3 pp. 7-9): requests waiting, each with the
     * instruction its device supplies on S8; the channels whose Jump Subroutine service is under
     * way (it ends at the first Jump Indirect; R10); FPRI's freeze; and,
     * for the simulator, a hold while the CLOCK chain runs.
     */
    this.pri = {
      /** @type {Map<number, number>} channel -> PRI instruction */
      pending: new Map(),
      /** @type {number[]} */
      service: [],
      frozen: false,
      hold: false,
      /** instructions served, per channel */
      /** @type {Map<number, number>} */
      served: new Map(),
    };
  }

  /**
   * A device asks for service on a PRI channel, supplying its instruction.
   * @param {number} channel 0-24; 0 is the highest priority
   * @param {number} ins
   */
  request(channel, ins) {
    this.pri.pending.set(channel, ins);
  }

  /**
   * The channel to serve before the next instruction, or null: the highest waiting request,
   * unless interrupts are frozen or a channel of the same or higher priority is in service.
   * @returns {number | null}
   */
  nextRequest() {
    const pri = this.pri;
    if (pri.frozen || pri.hold || pri.pending.size === 0) return null;
    const ch = Math.min(...pri.pending.keys());
    if (pri.service.length && ch >= /** @type {number} */ (pri.service.at(-1))) return null;
    return ch;
  }

  /**
   * Serves a PRI request: the channel's instruction goes to IR as if it came from memory, through
   * a 1 us FPI fetch instead of the 2 us memory fetch, its first execute cycle stretched to 2 us if
   * it is immediate (3 us in all for most). LC is not stepped, so unless the instruction jumps,
   * the program carries on where it was. A Jump Subroutine opens a service that runs until the
   * subroutine returns.
   * @param {number} ch
   * @returns {number} us
   */
  servePri(ch) {
    const ins = /** @type {number} */ (this.pri.pending.get(ch));
    this.pri.pending.delete(ch);
    this.pri.served.set(ch, (this.pri.served.get(ch) ?? 0) + 1);
    const lc = this.LC;
    const kind = get(ins, ENCODING.kind);
    const op = kind === KIND.OTHER ? opName(ins) : undefined;
    let us = this.execute(ins) - 1;
    if (kind === KIND.IMMEDIATE) us += 1;
    if ((op === "JPSR" || op === "JSAN" || op === "JSLS") && this.LC !== lc) this.pri.service.push(ch);
    this.instructions++;
    this.time += us;
    return us;
  }

  /** @param {number} bit @param {boolean} v */
  setSense(bit, v) {
    const m = 2 ** (29 - bit);
    const on = Math.floor(this.S4 / m) % 2 === 1;
    if (on !== v) this.S4 += v ? m : -m;
  }

  /**
   * Increments the lower half of a word in memory, modulo 2^15 (DPR2SPI p. 32).
   * @param {number} a
   */
  index(a) {
    const w = this.core.read(a);
    this.core.write(a, word(hi(w), lo(w) + 1));
  }

  /**
   * The effective address of an instruction (DPR2SPI pp. 32-33). While the word in hand has 'I,
   * its 'X first increments the word it points to, which is then read, and the next level's 'X
   * and 'I are that word's. What is left at the end: the address, the last word read (MD), and
   * a final 'X, which a memory cycle of the execute cycle applies.
   * @param {number} ins
   * @returns {{ ea: number; md: number; x: boolean; us: number }}
   */
  address(ins) {
    let ea = lo(ins);
    let md = ins;
    let us = 0;
    let x = get(ins, ENCODING.index) === 1;
    let i = get(ins, ENCODING.indirect) === 1;
    for (let n = 0; i && n < 64; n++) {
      if (x) this.index(ea);
      md = this.core.read(ea);
      us += TIME.indirect;
      ea = lo(md);
      x = get(md, ENCODING.index) === 1;
      i = get(md, ENCODING.indirect) === 1;
    }
    return { ea: ea & M15, md, x, us };
  }

  /**
   * AN: AR is negative, AR[0] is 1 (DPR2SPI p. 37). One's complement -0 is negative.
   * @returns {boolean}
   */
  negative() {
    return this.AR >= 0o4000000000;
  }

  /**
   * LS: AR has lower significance, AR[15-29] is not +0 (DPR2SPI p. 37). -0 has.
   * @returns {boolean}
   */
  lowerSignificance() {
    return lo(this.AR) !== 0;
  }

  /**
   * Executes one instruction.
   * @returns {number} its time, us
   */
  step() {
    const ch = this.nextRequest();
    if (ch !== null) return this.servePri(ch);
    const ins = this.core.read(this.LC);
    this.last = this.LC;
    this.LC = (this.LC + 1) & M15;
    this.instructions++;
    // the end of a Jump Subroutine service: the first Jump Indirect. The Model 5 manual adds "or
    // successful conditional jump" (SRM5 DPR3 p. 8), but AMRMX's interrupt routines take
    // conditional jumps before their Jump Indirect, and run as written only if those do not end
    // the service (research/amrmx.md; R10)
    let ends = false;
    if (this.pri.service.length && get(ins, ENCODING.kind) === KIND.OTHER) ends = opName(ins) === "JUMP" && get(ins, ENCODING.indirect) === 1;
    const us = this.execute(ins);
    this.time += us;
    if (ends) this.pri.service.pop();
    return us;
  }


  /**
   * Executes an instruction word (from memory, or put on the bus to IR).
   * @param {number} ins
   * @returns {number} us
   */
  execute(ins) {
    // a word sent to IR is the next instruction, without a return: a chain of them, as LIFE runs
    // its board, is a loop here, not a nesting
    let us = 0;
    let w = ins;
    for (let n = 0; ; n++) {
      this.irNext = null;
      us += this.executeOne(w);
      const next = /** @type {number | null} */ (this.irNext);
      if (next === null) return us;
      if (n >= IR_CHAIN) {
        this.stopped = `endless chain of instructions through IR at ${((this.LC - 1) & M15).toString(8).padStart(5, "0")}`;
        return us;
      }
      w = next;
    }
  }

  /**
   * Executes one instruction word; a word it sends to IR is left in irNext.
   * @param {number} ins
   * @returns {number} us
   */
  executeOne(ins) {
    if (get(ins, ENCODING.kind) !== KIND.OTHER) return this.transfer(ins);
    const op = opName(ins);
    const neg = this.negative();
    const lowNz = this.lowerSignificance();
    const c = op === undefined ? conditionOf(ins) : undefined;
    if (c) {
      // ANDD, LSDD: the word at the address to the destination, if the condition holds
      if (!(c === "AN" ? neg : lowNz)) return TIME.skip;
      let t = put(put(ins, ENCODING.kind, KIND.MEMORY), ENCODING.source, SOURCES.MD);
      t = put(t, ENCODING.rotate, 0);
      return this.transfer(t);
    }
    const a = this.address(ins);
    switch (op) {
      case "JUMP":
        this.LC = a.ea;
        return TIME.jump + a.us;
      case "JPAN":
        if (neg) this.LC = a.ea;
        return TIME.jump + a.us;
      case "JPLS":
        if (lowNz) this.LC = a.ea;
        return TIME.jump + a.us;
      case "JPSR":
      case "JSAN":
      case "JSLS":
        if (op === "JPSR" || (op === "JSAN" && neg) || (op === "JSLS" && lowNz)) {
          // the return replaces the address half; the rest of the word is left as it was (p. 35)
          this.core.write(a.ea, word(hi(this.core.read(a.ea)), this.LC));
          this.LC = (a.ea + 1) & M15;
        }
        return TIME.jpsr + a.us;
      case "SKUA":
        if ((hi(this.S4) & a.ea) !== 0) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case "SKLA":
        if ((lo(this.S4) & a.ea) !== 0) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case "MPYU":
      case "MPYL":
      case "MPYI":
      case "DIVU":
      case "DIVL":
      case "DIVI":
      case "ARRS":
      case "ARLS":
      case "NORM":
      case "ERAR":
        return this.eau(op, a.ea) + a.us;
      case "OPTY":
        // OPTY strobes BR[22] out to the Teletype, a bit at a time (DPR2SPI p. 43), when the
        // Teletype's line is modeled (ttyline.js, for AMRMX). Without it, ours types the
        // character in AR[24-29] whole, and skips when the Teletype took it (R9).
        if (this.devices.strobe) {
          this.devices.strobe(Math.floor(this.BR / 2 ** 7) % 2);
          return TIME.opio;
        }
        if (this.devices.type(this.AR % 64)) this.LC = (this.LC + 1) & M15;
        return TIME.opio;
      case "CNVT":
        this.convert();
        return TIME.opio;
      case "FPRI":
        this.pri.frozen = true;
        return TIME.immediate;
      case "UPRI":
        this.pri.frozen = false;
        return TIME.immediate;
      case "PINT":
        // a request on channel 14, served as JPSR'I PIPVT (DPR2SPI p. 40)
        this.request(CHANNEL.PINT, assembleOp("JPSR", PIPVT, { I: true }));
        return TIME.immediate;
      case "NOOP":
        return TIME.immediate;
      case "OPCR":
      case "OPTI":
      case "OPIO":
        // the card reader, the telephone line and the other devices are not fitted
        return TIME.opio;
      default: {
        this.stopped = `no such instruction ${ins.toString(8).padStart(10, "0")} at ${((this.LC - 1) & M15).toString(8).padStart(5, "0")}`;
        return TIME.immediate;
      }
    }
  }

  /**
   * A transfer on the bus: source, rotation, logic, destination (DPR2SPI pp. 19-34). Its memory
   * operand is the word at the effective address, read through any indirect chain and after any
   * index; with 'L, the word after the instruction, which is then skipped; with 'F, MD as fetched:
   * the instruction itself, or the last word of its indirect chain.
   * @param {number} ins
   * @returns {number} us
   */
  transfer(ins) {
    const kind = get(ins, ENCODING.kind);
    const src = get(ins, ENCODING.source);
    const dst = get(ins, ENCODING.destination);
    const logic = get(ins, ENCODING.logic);
    const rot = [0, 1, 6, 15][get(ins, ENCODING.rotate)];
    let us = kind === KIND.IMMEDIATE ? TIME.immediate : TIME.memory;
    let ea = 0;
    let md = ins;
    if (kind === KIND.NEXT) {
      ea = this.LC;
      this.LC = (this.LC + 1) & M15;
      md = this.core.read(ea);
    } else {
      const a = this.address(ins);
      us += a.us;
      ea = a.ea;
      md = a.md;
      if (kind === KIND.MEMORY) {
        // a read/index/store memory cycle in place of read/restore (p. 19)
        if (a.x && dst !== DESTS.MD) this.index(ea);
        if (dst !== DESTS.MD) md = this.core.read(ea);
      }
    }
    let v;
    switch (src) {
      case SOURCES.MD:
        v = md;
        break;
      case SOURCES.AR:
        v = this.AR;
        break;
      case SOURCES.IC:
        v = this.IC;
        break;
      case SOURCES.BR:
        v = this.BR;
        break;
      case SOURCES.S4:
        v = this.S4;
        break;
      case SOURCES.S5:
        v = or30(this.devices.switches(), this.adc);
        break;
      default:
        v = 0;
    }
    if (rot) v = rotl(v, rot);
    if (logic === 3) v = M30 - v;
    /** @param {number} old @returns {number} */
    const combine = (old) => (logic === 2 ? and30(old, v) : logic === 1 ? or30(old, v) : v);
    switch (dst) {
      case DESTS.MD:
        // A store with 'O sets the word to -0, all ones, whatever the source holds: Adage's own
        // sources use ARMD'O to set a flag ("SET BUSY FLAG" in DISP2, "SET DISK FLAG", "SET
        // NEGATIVE" in FORTRAN, whose label buffer ends with a -0 "SET" so), AMRMX's statement
        // reader needs it to start a count at -0, and LIFE's frame flag to be set by it. To other
        // destinations 'O is an OR, as the manual says (R1; research/amrmx.md).
        this.core.write(ea, logic === 1 ? M30 : combine(this.core.read(ea)));
        break;
      case DESTS.AR:
        this.AR = combine(this.AR);
        break;
      case DESTS.IC:
        this.IC = combine(this.IC);
        break;
      case DESTS.BR:
        this.BR = combine(this.BR);
        break;
      case DESTS.IR:
        // the word becomes the next instruction, run by execute() once this one is done
        this.irNext = v;
        break;
      case DESTS.MX:
        // with IC bit 10 clear, a device may take it for the array's registers (avg1.js, R22)
        if (this.devices.write?.(dst, v, logic)) break;
        // GDD1 selects the input; on the AGT/30 the selection also starts a conversion (p. 41)
        this.mux = lo(v) & 0o17;
        this.convert();
        break;
      case DESTS.AS: {
        // the operand's lower half, its sign extended, added to all of AR (p. 24)
        const b = lo(combine(this.AR));
        const r = onesAdd(this.AR, b & 0o40000 ? word(M15, b) : b, 30);
        this.AR = r.sum;
        if (r.overflow) this.setSense(SENSE.OVERFLOW, true);
        break;
      }
      case DESTS.AE: {
        const r = onesAdd(this.AR, combine(this.AR), 30);
        this.AR = r.sum;
        if (r.overflow) this.setSense(SENSE.OVERFLOW, true);
        break;
      }
      case DESTS.XO:
        this.AR = xor30(this.AR, combine(this.AR));
        break;
      default:
        // 05, 06, 10-14: the subsystems' registers (DPR2BD), which do their own 'O and 'A
        this.devices.write?.(dst, v, logic);
        break;
    }
    return us;
  }

  /**
   * ADC5 converts the selected input to S5[15-29], a 15-bit fraction (DPR2BD; DPR2SPI p. 40).
   * The conversion is taken as done at once.
   */
  convert() {
    const f = Math.max(-1, Math.min(1, this.devices.analog(this.mux)));
    const n = Math.round(f * 0o40000);
    if (n >= 0o40000) this.setSense(SENSE.ADC, true);
    const c = Math.max(-0o37777, Math.min(0o37777, n));
    this.adc = c >= 0 ? c : M15 + c;
  }

  /**
   * The EAU's special instructions (DPR2SPI pp. 43-46). Multiplication takes AR[15-29] by a 15-bit
   * operand, both fractions: the product appears in AR[0-28], and AR[29] repeats its sign.
   * Division takes all of AR by a 15-bit operand: the quotient appears in AR[15-29], the
   * remainder, in absolute value, in AR[0-14]. MPYI and DIVI take the address field itself.
   * @param {string} op
   * @param {number} ea
   * @returns {number} us
   */
  eau(op, ea) {
    const s15 = (/** @type {number} */ h) => (h & 0o40000 ? -(~h & M15) : h);
    const ar15 = s15(lo(this.AR));
    const m = this.core.read(ea);
    switch (op) {
      case "MPYU":
      case "MPYL":
      case "MPYI": {
        const b = op === "MPYU" ? s15(hi(m)) : op === "MPYL" ? s15(lo(m)) : s15(ea);
        this.AR = wval(2 * ar15 * b);
        return TIME.mul;
      }
      case "DIVU":
      case "DIVL":
      case "DIVI": {
        const b = op === "DIVU" ? s15(hi(m)) : op === "DIVL" ? s15(lo(m)) : s15(ea);
        const a = sval(this.AR);
        const q = b === 0 ? Infinity : Math.trunc(a / (2 * b));
        if (Math.abs(q) > 0o37777) {
          this.setSense(SENSE.OVERFLOW, true);
          return TIME.div;
        }
        const r = Math.abs(a - 2 * b * q);
        this.AR = word(r, q >= 0 ? q : M15 + q);
        return TIME.div;
      }
      case "ARRS":
        this.AR = wval(Math.trunc(sval(this.AR) / 2 ** Math.min(29, ea)));
        return TIME.shift;
      case "ARLS": {
        // the shifter NORM uses (p. 46): each place moves AR[0-29] left and fills AR[29] with the
        // sign AR[0] had, so bits pass into AR[0]; AMRMX's display handler packs a character into
        // AR[0-6] so (research/amrmx.md; R1)
        let a = this.AR;
        for (let k = Math.min(29, ea); k > 0; k--) a = ((a * 2) % 2 ** 30) + (a >= 0o4000000000 ? 1 : 0);
        this.AR = a;
        return TIME.shift;
      }
      case "NORM": {
        let a = sval(this.AR);
        let n = 0;
        while (a !== 0 && Math.abs(a) < 0o2000000000 && n < 29) {
          a *= 2;
          n++;
        }
        this.AR = wval(a);
        this.ER = n;
        return TIME.shift;
      }
      case "ERAR":
        this.AR = this.ER;
        return TIME.immediate;
      default:
        return TIME.immediate;
    }
  }

  /**
   * Runs from an address until the location counter reaches `until`, the processor stops, or
   * the time runs out.
   * @param {number} start
   * @param {number} until
   * @param {number} maxUs
   * @returns {{ us: number; done: boolean }}
   */
  run(start, until, maxUs) {
    this.LC = start;
    return this.resume(until, maxUs);
  }

  /**
   * Continues from LC.
   * @param {number} until
   * @param {number} maxUs
   * @returns {{ us: number; done: boolean }}
   */
  resume(until, maxUs) {
    let us = 0;
    this.stopped = null;
    while (us < maxUs) {
      if (this.LC === until && this.nextRequest() === null) return { us, done: true };
      if (this.LC === this.breakAt) return { us, done: true };
      us += this.step();
      if (this.stopped) return { us, done: true };
    }
    return { us, done: false };
  }

  /**
   * Calls a subroutine as the monitor does (AMRMX p. 3): JPSR SUBR, the arguments, a null word,
   * then the return; it runs until control comes back to the return.
   * @param {number} sub
   * @param {number[]} args
   * @param {number} scratch where to build the calling sequence
   * @param {number} [maxUs]
   * @returns {{ us: number; done: boolean; ret: number }}
   */
  call(sub, args, scratch, maxUs = 1e6) {
    const core = this.core;
    core.write(scratch, assembleOp("JPSR", sub));
    args.forEach((v, i) => core.write(scratch + 1 + i, v));
    core.write(scratch + 1 + args.length, 0);
    const ret = scratch + 2 + args.length;
    core.write(ret, assembleOp("NOOP", 0));
    const r = this.run(scratch, ret, maxUs);
    return { ...r, ret };
  }
}

/** @param {number} a @param {number} b */
const and30 = (a, b) => word(hi(a) & hi(b), lo(a) & lo(b));
/** @param {number} a @param {number} b */
const or30 = (a, b) => word(hi(a) | hi(b), lo(a) | lo(b));
/** @param {number} a @param {number} b */
const xor30 = (a, b) => word(hi(a) ^ hi(b), lo(a) ^ lo(b));

/**
 * The modifiers an instruction may carry after quotes: 'I indirect, 'X index, 'F immediate, 'L next word,
 * 'A 'O 'N logic, 'B 'K 'H rotation (ADEPT App. B lists the letters).
 * @typedef {{ I?: boolean; X?: boolean; F?: boolean; L?: boolean; A?: boolean; O?: boolean; N?: boolean; B?: boolean; K?: boolean; H?: boolean }} Mods
 */

/** The transfer mnemonics' two halves. */
const SRC_NAMES = /** @type {Record<string, number>} */ (SOURCES);
const DST_NAMES = /** @type {Record<string, number>} */ (DESTS);

/**
 * A destination by name, or by number as ADEPT writes one (MD10, AR07: octal).
 * @param {string} d
 * @returns {number | undefined}
 */
const destination = (d) => (/^[0-7]{2}$/.test(d) ? parseInt(d, 8) & 0o17 : DST_NAMES[d]);

/** @param {string} m @returns {boolean} */
const isTransfer = (m) => m.length === 4 && m.slice(0, 2) in SRC_NAMES && destination(m.slice(2)) !== undefined;
/** @param {string} m @returns {boolean} */
const isConditional = (m) => m.length === 4 && m.slice(0, 2) in CONDITIONS && destination(m.slice(2)) !== undefined;

/**
 * Whether a mnemonic is a DPR-2 instruction.
 * @param {string} m
 * @returns {boolean}
 */
export function isInstruction(m) {
  return m in OPS || m in ALIASES || isTransfer(m) || isConditional(m);
}

/**
 * Assembles one instruction word.
 * @param {string} m mnemonic
 * @param {number} address
 * @param {Mods} [mods]
 * @returns {number}
 */
export function assembleOp(m, address, mods = {}) {
  let w = address & M15;
  if (isTransfer(m)) {
    w = put(w, ENCODING.kind, mods.F ? KIND.IMMEDIATE : mods.L ? KIND.NEXT : KIND.MEMORY);
    w = put(w, ENCODING.source, SRC_NAMES[m.slice(0, 2)]);
    w = put(w, ENCODING.destination, /** @type {number} */ (destination(m.slice(2))));
    w = put(w, ENCODING.logic, mods.O ? 1 : mods.A ? 2 : mods.N ? 3 : 0);
    w = put(w, ENCODING.rotate, mods.B ? 1 : mods.K ? 2 : mods.H ? 3 : 0);
  } else if (isConditional(m)) {
    w = put(w, ENCODING.op, CONDITIONS[m.slice(0, 2)] / 4);
    w = put(w, ENCODING.destination, /** @type {number} */ (destination(m.slice(2))));
    w = put(w, ENCODING.logic, mods.O ? 1 : mods.A ? 2 : mods.N ? 3 : 0);
  } else if (m in OPS || m in ALIASES) {
    w = put(w, ENCODING.op, OPS[ALIASES[m] ?? m] / 4);
  } else throw new Error(`unknown instruction ${m}`);
  w = put(w, ENCODING.index, mods.X ? 1 : 0);
  w = put(w, ENCODING.indirect, mods.I ? 1 : 0);
  return w;
}

/**
 * Disassembles an instruction word (for listings and the panel).
 * @param {number} w
 * @returns {string}
 */
export function disassemble(w) {
  const mods = (get(w, ENCODING.index) ? "'X" : "") + (get(w, ENCODING.indirect) ? "'I" : "");
  const a = lo(w).toString(8).padStart(5, "0");
  const kind = get(w, ENCODING.kind);
  if (kind !== KIND.OTHER) {
    const s = Object.keys(SRC_NAMES).find((k) => SRC_NAMES[k] === get(w, ENCODING.source)) ?? "??";
    const d = Object.keys(DST_NAMES).find((k) => DST_NAMES[k] === get(w, ENCODING.destination)) ?? get(w, ENCODING.destination).toString(8).padStart(2, "0");
    const lg = ["", "'O", "'A", "'N"][get(w, ENCODING.logic)];
    const rt = ["", "'B", "'K", "'H"][get(w, ENCODING.rotate)];
    const k = ["", "", "'L", "'F"][kind];
    return `${s}${d}${k}${lg}${rt}${mods} ${a}`;
  }
  const c = opName(w) === undefined ? conditionOf(w) : undefined;
  if (c) {
    const d = Object.keys(DST_NAMES).find((k) => DST_NAMES[k] === get(w, ENCODING.destination)) ?? get(w, ENCODING.destination).toString(8).padStart(2, "0");
    return `${c}${d}${["", "'O", "'A", "'N"][get(w, ENCODING.logic)]}${mods} ${a}`;
  }
  return `${opName(w) ?? "?"}${mods} ${a}`;
}
