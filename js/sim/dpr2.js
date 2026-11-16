// SPDX-License-Identifier: Apache-2.0
//
// The DPR-2 processor at instruction level.
//
// Documented (SRM5 DPR3 pp. 1-14; ADEPT App. B; AMRMX): 30-bit one's-complement words;
// a 2 us memory cycle; a transfer bus from 8 sources to 16 destinations that can AND, OR and
// complement and rotate left by 1, 6 or 15 bits on the way; instructions named source-then-
// destination (MDAR loads AR from memory, ARMD stores it, MDAE adds to AR, MDXO exclusive-ors);
// 13 bits of operation, an indirect bit, an index bit that increments the word it reads, and 15
// bits of address or operand; the jumps, skips, OPIO, the EAU's multiply and divide; and the
// times of each.
//
// Not documented, but shown by the NCSU tapes: where those fields sit in the word. The routines
// that survive as both ADEPT source and binary give the layout and the codes of most
// instructions (MH25; research/dpr2-encodings.md). ENCODING and OPS below hold them, in one place
// (D5). The codes of the instructions the tapes do not use are ours (R1). The EAU's product is
// R6; reading a dial through the comparator is R7.

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
  /** 'X: increment the lower half of the word read */
  index: [13, 13],
  /** 'I: indirect (bit 14, as an image item's address mode I is the same bit) */
  indirect: [14, 14],
};

/**
 * The kinds of instruction, bits 0-1: not a transfer; a transfer whose operand is the word at
 * the address; 'L, the next word; 'F, the address half itself.
 */
export const KIND = { OTHER: 0, MEMORY: 1, NEXT: 2, IMMEDIATE: 3 };

/** Sources on the transfer bus, octal as ADEPT numbers them (the tapes; DPR2BD). */
export const SOURCES = { MD: 0, AR: 1, BR: 2, IC: 3, S4: 4, S5: 5, S6: 6, S7: 7 };
/**
 * Destinations (the tapes; DPR2BD). XY, the array's X data, is D5 on the block diagram; MX, our
 * multiplexer, is its input selector GDD1, D7 (R7).
 */
export const DESTS = { MD: 0, AR: 1, BR: 2, IC: 3, IR: 4, XY: 5, MX: 7, AS: 0o15, AE: 0o16, XO: 0o17 };

/**
 * The instructions that are not transfers, by their upper half with 'X and 'I clear. These are
 * as the tripp tape's binaries show them.
 */
const TAPE_OPS = {
  NOOP: 0, JPSR: 0o20, JUMP: 0o40, JSAN: 0o60, JPAN: 0o100, JPLS: 0o140, SKUA: 0o220, SKLA: 0o240,
  UPRI: 0o340, FPRI: 0o360, MPYI: 0o15440, DIVI: 0o16440, ARRS: 0o17440, ARLS: 0o17500, NORM: 0o17520,
  ERAR: 0o17540,
};
/**
 * Those the tapes do not show, numbered by us (R1). JSLS follows the pattern of JPSR and JSAN
 * (a jump less 20); the rest sit where the tapes show nothing.
 */
const OUR_OPS = {
  JSLS: 0o120, SKAN: 0o400, SKLS: 0o420, OPIO: 0o600, PINT: 0o620, OPTY: 0o640, OPTI: 0o660,
  MPYU: 0o15400, MPYL: 0o15420, DIVU: 0o16400, DIVL: 0o16420,
};
/** @type {Record<string, number>} */
export const OPS = { ...TAPE_OPS, ...OUR_OPS };
/** @type {Map<number, string>} */
const OP_NAMES = new Map(Object.entries(OPS).map(([k, v]) => [v, k]));

/**
 * The name of an instruction that is not a transfer, or undefined.
 * @param {number} ins
 * @returns {string | undefined}
 */
export const opName = (ins) => OP_NAMES.get(get(ins, ENCODING.op) * 4);

/** Times in microseconds (SRM5 DPR3 pp. 4-6, 10). */
export const TIME = { memory: 4, immediate: 3, jump: 3, jpsr: 5, skip: 3, opio: 6, indirect: 2, mul: 6, div: 8, shift: 5 };

/** Sense line bits (S4), numbered from the left. Bit 0: AR overflow (FJCC68 Fig. 17 channel 0); bit 24: the array's comparator (SRM5 GHA4). */
export const SENSE = { OVERFLOW: 0, COMPARATOR: 24 };

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
 * the array's multiplexer and comparator.
 * @typedef {object} Devices
 * @property {(code: number) => boolean} type types a 6-bit AMOS character; false while the Teletype is busy
 * @property {() => number | null} key the next character typed, or null
 * @property {() => number} switches the function switches and pedals (S5): bits 0-15 keys, 16-17 pedals
 * @property {(channel: number) => number} analog an analog input, -1..1 (dials, joystick)
 */

/** @type {Devices} */
const NO_DEVICES = { type: () => true, key: () => null, switches: () => 0, analog: () => 0 };

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
    /** Sense lines S4. */
    this.S4 = 0;
    /** The multiplexer channel (destination MX) and the X data register (destination XY), for the comparator. */
    this.mux = 0;
    this.xdata = 0;
    this.time = 0;
    this.instructions = 0;
    /** @type {string | null} why the processor stopped */
    this.stopped = null;
    /**
     * The priority interrupt (PRI) subsystem (SRM5 DPR3 pp. 7-9): requests waiting, each with the
     * instruction its device supplies on S8; the channels whose Jump Subroutine service is under
     * way (it ends at the first Jump Indirect or successful conditional jump); FPRI's freeze; and,
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
   * The effective address of an instruction: indirect chains, and the index increment.
   * @param {number} ins
   * @returns {{ ea: number; us: number }}
   */
  address(ins) {
    let ea = lo(ins);
    let us = 0;
    const x = get(ins, ENCODING.index) === 1;
    if (get(ins, ENCODING.indirect) === 1) {
      // follow the chain while each pointer word has its own indirect bit set
      for (let n = 0; n < 64; n++) {
        const p = this.core.read(ea);
        us += TIME.indirect;
        if (x && n === 0) this.core.write(ea, word(hi(p), lo(p) + 1));
        ea = lo(p);
        if (get(p, ENCODING.indirect) !== 1) break;
      }
    }
    return { ea: ea & M15, us };
  }

  /**
   * Executes one instruction.
   * @returns {number} its time, us
   */
  step() {
    const ch = this.nextRequest();
    if (ch !== null) return this.servePri(ch);
    const ins = this.core.read(this.LC);
    this.LC = (this.LC + 1) & M15;
    this.instructions++;
    // the end of a Jump Subroutine service: the first Jump Indirect or successful conditional jump
    let ends = false;
    if (this.pri.service.length && get(ins, ENCODING.kind) === KIND.OTHER) {
      const op = opName(ins);
      const neg = this.AR >= 0o4000000000 && this.AR !== M30;
      const lowNz = lo(this.AR) !== 0 && lo(this.AR) !== M15;
      ends = (op === "JUMP" && get(ins, ENCODING.indirect) === 1) || (op === "JPAN" && neg) || (op === "JPLS" && lowNz);
    }
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
    if (get(ins, ENCODING.kind) !== KIND.OTHER) return this.transfer(ins);
    const op = opName(ins);
    const a = this.address(ins);
    const neg = this.AR >= 0o4000000000 && this.AR !== M30;
    const lowNz = lo(this.AR) !== 0 && lo(this.AR) !== M15;
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
          this.core.write(a.ea, word(0, this.LC));
          this.LC = (a.ea + 1) & M15;
        }
        return TIME.jpsr + a.us;
      case "SKUA":
        if ((hi(this.S4) & a.ea) !== 0) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case "SKLA":
        if ((lo(this.S4) & a.ea) !== 0) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case "SKAN":
        if (neg) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case "SKLS":
        if (lowNz) this.LC = (this.LC + 1) & M15;
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
        // type the character in AR[24-29]; skip when the Teletype took it
        if (this.devices.type(this.AR % 64)) this.LC = (this.LC + 1) & M15;
        return TIME.opio;
      case "OPTI": {
        const k = this.devices.key();
        if (k !== null) {
          this.AR = k;
          this.LC = (this.LC + 1) & M15;
        }
        return TIME.opio;
      }
      case "FPRI":
        this.pri.frozen = true;
        return TIME.immediate;
      case "UPRI":
        this.pri.frozen = false;
        return TIME.immediate;
      case "NOOP":
      case "PINT":
        return TIME.immediate;
      case "OPIO":
        return TIME.opio;
      default:
        this.stopped = `no such instruction ${ins.toString(8).padStart(10, "0")} at ${((this.LC - 1) & M15).toString(8).padStart(5, "0")}`;
        return TIME.immediate;
    }
  }

  /**
   * A transfer on the bus: source, rotation, logic, destination. Its memory operand is the word
   * at the address, or with 'L the word after the instruction, which is then skipped.
   * @param {number} ins
   * @returns {number} us
   */
  transfer(ins) {
    const kind = get(ins, ENCODING.kind);
    const src = get(ins, ENCODING.source);
    const dst = get(ins, ENCODING.destination);
    const logic = get(ins, ENCODING.logic);
    const rot = [0, 1, 6, 15][get(ins, ENCODING.rotate)];
    const imm = kind === KIND.IMMEDIATE;
    let us = imm ? TIME.immediate : TIME.memory;
    /** @type {number} */
    let ea = lo(ins);
    if (kind === KIND.NEXT) {
      ea = this.LC;
      this.LC = (this.LC + 1) & M15;
    }
    const needsMemory = kind === KIND.MEMORY && (src === SOURCES.MD || dst === DESTS.MD);
    if (needsMemory) {
      const a = this.address(ins);
      ea = a.ea;
      us += a.us;
    }
    let v;
    switch (src) {
      case SOURCES.MD:
        v = imm ? lo(ins) : this.core.read(ea);
        if (!imm && get(ins, ENCODING.index) === 1 && get(ins, ENCODING.indirect) !== 1) {
          // the index bit increments the lower half of the word read (SRM5 DPR3 p. 4)
          this.core.write(ea, word(hi(v), lo(v) + 1));
        }
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
        v = this.devices.switches();
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
        this.core.write(ea, combine(this.core.read(ea)));
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
        us += this.execute(v);
        break;
      case DESTS.XY: {
        // the X data register: compared, through the multiplexer, with an analog input (SRM5 GHA4)
        this.xdata = lo(v);
        const x = (this.xdata & 0o40000 ? -(~this.xdata & M15) : this.xdata) / 0o40000;
        this.setSense(SENSE.COMPARATOR, this.devices.analog(this.mux) - x < 0);
        break;
      }
      case DESTS.MX:
        this.mux = lo(v) & 0o17;
        break;
      case DESTS.AS: {
        const r = onesAdd(lo(this.AR), lo(v), 15);
        this.AR = word(hi(this.AR), r.sum);
        if (r.overflow) this.setSense(SENSE.OVERFLOW, true);
        break;
      }
      case DESTS.AE: {
        const r = onesAdd(this.AR, v, 30);
        this.AR = r.sum;
        if (r.overflow) this.setSense(SENSE.OVERFLOW, true);
        break;
      }
      case DESTS.XO:
        this.AR = xor30(this.AR, v);
        break;
      default:
        break;
    }
    return us;
  }

  /**
   * The EAU option (SRM5 DPR3 p. 5). Products are of 15-bit numbers; MPYI multiplies by the
   * address field itself. The product is a 30-bit integer in AR (AR's upper half is then the
   * product of two fractions, halved: shift left one for a fraction).
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
        this.AR = wval(ar15 * b);
        return TIME.mul;
      }
      case "DIVU":
      case "DIVL":
      case "DIVI": {
        const b = op === "DIVU" ? s15(hi(m)) : op === "DIVL" ? s15(lo(m)) : s15(ea);
        const a = sval(this.AR);
        if (b === 0) {
          this.setSense(SENSE.OVERFLOW, true);
          return TIME.div;
        }
        this.ER = wval(a % b);
        this.AR = wval(Math.trunc(a / b));
        return TIME.div;
      }
      case "ARRS":
        this.AR = wval(Math.trunc(sval(this.AR) / 2 ** Math.min(29, ea)));
        return TIME.shift;
      case "ARLS":
        this.AR = wval(sval(this.AR) * 2 ** Math.min(29, ea));
        return TIME.shift;
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
 * The modifiers an instruction may carry after quotes: 'I indirect, 'X index, 'F immediate,
 * 'A 'O 'N logic, 'B 'K 'H rotation (ADEPT App. B lists the letters).
 * @typedef {{ I?: boolean; X?: boolean; F?: boolean; A?: boolean; O?: boolean; N?: boolean; B?: boolean; K?: boolean; H?: boolean }} Mods
 */

/** The transfer mnemonics' two halves. */
const SRC_NAMES = /** @type {Record<string, number>} */ (SOURCES);
const DST_NAMES = /** @type {Record<string, number>} */ (DESTS);

/** @param {string} m @returns {boolean} */
const isTransfer = (m) => m.length === 4 && m.slice(0, 2) in SRC_NAMES && m.slice(2) in DST_NAMES;

/**
 * Whether a mnemonic is a DPR-2 instruction.
 * @param {string} m
 * @returns {boolean}
 */
export function isInstruction(m) {
  return m in OPS || isTransfer(m);
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
    w = put(w, ENCODING.kind, mods.F ? KIND.IMMEDIATE : KIND.MEMORY);
    w = put(w, ENCODING.source, SRC_NAMES[m.slice(0, 2)]);
    w = put(w, ENCODING.destination, DST_NAMES[m.slice(2)]);
    w = put(w, ENCODING.logic, mods.O ? 1 : mods.A ? 2 : mods.N ? 3 : 0);
    w = put(w, ENCODING.rotate, mods.B ? 1 : mods.K ? 2 : mods.H ? 3 : 0);
  } else if (m in OPS) {
    w = put(w, ENCODING.op, OPS[m] / 4);
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
    const d = Object.keys(DST_NAMES).find((k) => DST_NAMES[k] === get(w, ENCODING.destination)) ?? "??";
    const lg = ["", "'O", "'A", "'N"][get(w, ENCODING.logic)];
    const rt = ["", "'B", "'K", "'H"][get(w, ENCODING.rotate)];
    const k = ["", "", "'L", "'F"][kind];
    return `${s}${d}${k}${lg}${rt}${mods} ${a}`;
  }
  return `${opName(w) ?? "?"}${mods} ${a}`;
}
