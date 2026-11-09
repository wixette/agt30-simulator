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
// Not documented: where those fields sit in the word. ENCODING below is our reconstruction
// (R1), in one place (D5), so that the real layout can replace it if Volume II or a tape turns
// up. Programs assembled here run the same either way; only their octal words would change.
// The EAU's product is R6; reading a dial through the comparator is R7.

import { Core } from "./image.js";
import { hi, lo, M15, M30, word } from "./words.js";

/** @typedef {readonly [number, number]} Field bits from..to */

/**
 * The reconstructed instruction layout (bit 0 is the leftmost of 30).
 * @type {Record<"kind" | "immediate" | "source" | "destination" | "logic" | "rotate" | "op" | "variant" | "index" | "indirect", Field>}
 */
export const ENCODING = {
  /** bit 0: 0 = a transfer on the bus, 1 = any other instruction */
  kind: [0, 0],
  /** transfers: bit 1 = 'F (the address field is the operand: no memory cycle) */
  immediate: [1, 1],
  source: [2, 4],
  destination: [5, 8],
  /** 0 plain, 1 'A (AND into the destination), 2 'O (OR), 3 'N (complement) */
  logic: [9, 10],
  /** 0 none, 1 'B (1 bit), 2 'K (6 bits), 3 'H (15 bits): left rotation on the bus */
  rotate: [11, 12],
  /** other instructions: bits 1-4 the operation, bits 5-12 its variant */
  op: [1, 4],
  variant: [5, 12],
  /** 'X: increment the lower half of the word read */
  index: [13, 13],
  /** 'I: indirect (bit 14, as an image item's address mode I is the same bit) */
  indirect: [14, 14],
};

/** Sources on the transfer bus (AGT/5 assignments, SRM5 Table 1). */
export const SOURCES = { MD: 0, AR: 1, IC: 2, BR: 3, S4: 4, S5: 5, S6: 6, S7: 7 };
/** Destinations (SRM5 Table 1; IR from ADEPT's mnemonics). */
export const DESTS = { MD: 0, AR: 1, IC: 2, BR: 3, IR: 4, XY: 5, CZ: 6, X0: 7, CT: 8, MX: 9, LP: 10, HS: 12, AS: 13, AE: 14, XO: 15 };
/** The non-transfer operations, numbered in the reconstruction. */
export const OPS2 = { JUMP: 0, JPAN: 1, JPLS: 2, JPSR: 3, JSAN: 4, JSLS: 5, SKUA: 6, SKLA: 7, SKAN: 8, SKLS: 9, OPIO: 10, EAU: 11, SPEC: 12 };
/** EAU variants (SRM5 DPR3 p. 5). */
export const EAU = { MPYU: 0, MPYL: 1, MPYI: 2, DIVU: 3, DIVL: 4, DIVI: 5, ARRS: 6, ARLS: 7, NORM: 8, ERAR: 9 };
/** Special variants: NOOP, FPRI and UPRI (ADEPT App. B), PINT (programmed interrupt), and the Teletype's OPTY / OPTI. */
export const SPEC = { NOOP: 0, FPRI: 1, UPRI: 2, PINT: 3, OPTY: 4, OPTI: 5 };

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
    const transfer = get(ins, ENCODING.kind) === 0;
    const op = transfer ? -1 : get(ins, ENCODING.op);
    let us = this.execute(ins) - 1;
    if (transfer && get(ins, ENCODING.immediate) === 1) us += 1;
    if ((op === OPS2.JPSR || op === OPS2.JSAN || op === OPS2.JSLS) && this.LC !== lc) this.pri.service.push(ch);
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
    if (this.pri.service.length && get(ins, ENCODING.kind) === 1) {
      const op = get(ins, ENCODING.op);
      const neg = this.AR >= 0o4000000000 && this.AR !== M30;
      const lowNz = lo(this.AR) !== 0 && lo(this.AR) !== M15;
      ends = (op === OPS2.JUMP && get(ins, ENCODING.indirect) === 1) || (op === OPS2.JPAN && neg) || (op === OPS2.JPLS && lowNz);
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
    if (get(ins, ENCODING.kind) === 0) return this.transfer(ins);
    const op = get(ins, ENCODING.op);
    const v = get(ins, ENCODING.variant);
    const a = this.address(ins);
    const neg = this.AR >= 0o4000000000 && this.AR !== M30;
    const lowNz = lo(this.AR) !== 0 && lo(this.AR) !== M15;
    switch (op) {
      case OPS2.JUMP:
        this.LC = a.ea;
        return TIME.jump + a.us;
      case OPS2.JPAN:
        if (neg) this.LC = a.ea;
        return TIME.jump + a.us;
      case OPS2.JPLS:
        if (lowNz) this.LC = a.ea;
        return TIME.jump + a.us;
      case OPS2.JPSR:
      case OPS2.JSAN:
      case OPS2.JSLS:
        if (op === OPS2.JPSR || (op === OPS2.JSAN && neg) || (op === OPS2.JSLS && lowNz)) {
          this.core.write(a.ea, word(0, this.LC));
          this.LC = (a.ea + 1) & M15;
        }
        return TIME.jpsr + a.us;
      case OPS2.SKUA:
        if ((hi(this.S4) & a.ea) !== 0) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case OPS2.SKLA:
        if ((lo(this.S4) & a.ea) !== 0) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case OPS2.SKAN:
        if (neg) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case OPS2.SKLS:
        if (lowNz) this.LC = (this.LC + 1) & M15;
        return TIME.skip;
      case OPS2.EAU:
        return this.eau(v, a.ea) + a.us;
      case OPS2.SPEC:
        if (v === SPEC.OPTY) {
          // type the character in AR[24-29]; skip when the Teletype took it
          if (this.devices.type(this.AR % 64)) this.LC = (this.LC + 1) & M15;
          return TIME.opio;
        }
        if (v === SPEC.OPTI) {
          const k = this.devices.key();
          if (k !== null) {
            this.AR = k;
            this.LC = (this.LC + 1) & M15;
          }
          return TIME.opio;
        }
        if (v === SPEC.FPRI) this.pri.frozen = true;
        if (v === SPEC.UPRI) this.pri.frozen = false;
        return TIME.immediate;
      case OPS2.OPIO:
        return TIME.opio;
      default:
        this.stopped = `no such instruction ${ins.toString(8).padStart(10, "0")} at ${((this.LC - 1) & M15).toString(8).padStart(5, "0")}`;
        return TIME.immediate;
    }
  }

  /**
   * A transfer on the bus: source, rotation, logic, destination.
   * @param {number} ins
   * @returns {number} us
   */
  transfer(ins) {
    const src = get(ins, ENCODING.source);
    const dst = get(ins, ENCODING.destination);
    const logic = get(ins, ENCODING.logic);
    const rot = [0, 1, 6, 15][get(ins, ENCODING.rotate)];
    const imm = get(ins, ENCODING.immediate) === 1;
    let us = imm ? TIME.immediate : TIME.memory;
    /** @type {number} */
    let ea = lo(ins);
    const needsMemory = !imm && (src === SOURCES.MD || dst === DESTS.MD);
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
    const combine = (old) => (logic === 1 ? and30(old, v) : logic === 2 ? or30(old, v) : v);
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
   * @param {number} v
   * @param {number} ea
   * @returns {number} us
   */
  eau(v, ea) {
    const s15 = (/** @type {number} */ h) => (h & 0o40000 ? -(~h & M15) : h);
    const ar15 = s15(lo(this.AR));
    const m = this.core.read(ea);
    switch (v) {
      case EAU.MPYU:
      case EAU.MPYL:
      case EAU.MPYI: {
        const b = v === EAU.MPYU ? s15(hi(m)) : v === EAU.MPYL ? s15(lo(m)) : s15(ea);
        this.AR = wval(ar15 * b);
        return TIME.mul;
      }
      case EAU.DIVU:
      case EAU.DIVL:
      case EAU.DIVI: {
        const b = v === EAU.DIVU ? s15(hi(m)) : v === EAU.DIVL ? s15(lo(m)) : s15(ea);
        const a = sval(this.AR);
        if (b === 0) {
          this.setSense(SENSE.OVERFLOW, true);
          return TIME.div;
        }
        this.ER = wval(a % b);
        this.AR = wval(Math.trunc(a / b));
        return TIME.div;
      }
      case EAU.ARRS:
        this.AR = wval(Math.trunc(sval(this.AR) / 2 ** Math.min(29, ea)));
        return TIME.shift;
      case EAU.ARLS:
        this.AR = wval(sval(this.AR) * 2 ** Math.min(29, ea));
        return TIME.shift;
      case EAU.NORM: {
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
      case EAU.ERAR:
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
const SRC_NAMES = /** @type {Record<string, number>} */ ({ MD: 0, AR: 1, IC: 2, BR: 3, S4: 4, S5: 5, S6: 6, S7: 7 });
const DST_NAMES = /** @type {Record<string, number>} */ ({ MD: 0, AR: 1, IC: 2, BR: 3, IR: 4, AS: 13, AE: 14, XO: 15, XY: 5, MX: 9 });

/**
 * Whether a mnemonic is a DPR-2 instruction.
 * @param {string} m
 * @returns {boolean}
 */
export function isInstruction(m) {
  if (m in OPS2 && m !== "EAU" && m !== "SPEC") return true;
  if (m in EAU || m in SPEC) return true;
  return m.length === 4 && m.slice(0, 2) in SRC_NAMES && m.slice(2) in DST_NAMES;
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
  if (m.length === 4 && m.slice(0, 2) in SRC_NAMES && m.slice(2) in DST_NAMES) {
    w = put(w, ENCODING.kind, 0);
    w = put(w, ENCODING.source, SRC_NAMES[m.slice(0, 2)]);
    w = put(w, ENCODING.destination, DST_NAMES[m.slice(2)]);
    w = put(w, ENCODING.immediate, mods.F ? 1 : 0);
    w = put(w, ENCODING.logic, mods.A ? 1 : mods.O ? 2 : mods.N ? 3 : 0);
    w = put(w, ENCODING.rotate, mods.B ? 1 : mods.K ? 2 : mods.H ? 3 : 0);
  } else {
    w = put(w, ENCODING.kind, 1);
    if (m in EAU) {
      w = put(w, ENCODING.op, OPS2.EAU);
      w = put(w, ENCODING.variant, EAU[/** @type {keyof typeof EAU} */ (m)]);
    } else if (m in SPEC) {
      w = put(w, ENCODING.op, OPS2.SPEC);
      w = put(w, ENCODING.variant, SPEC[/** @type {keyof typeof SPEC} */ (m)]);
    } else if (m in OPS2) {
      w = put(w, ENCODING.op, OPS2[/** @type {keyof typeof OPS2} */ (m)]);
    } else throw new Error(`unknown instruction ${m}`);
  }
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
  if (get(w, ENCODING.kind) === 0) {
    const s = Object.keys(SRC_NAMES).find((k) => SRC_NAMES[k] === get(w, ENCODING.source)) ?? "??";
    const d = Object.keys(DST_NAMES).find((k) => DST_NAMES[k] === get(w, ENCODING.destination)) ?? "??";
    const lg = ["", "'A", "'O", "'N"][get(w, ENCODING.logic)];
    const rt = ["", "'B", "'K", "'H"][get(w, ENCODING.rotate)];
    return `${s}${d}${get(w, ENCODING.immediate) ? "'F" : ""}${lg}${rt}${mods} ${a}`;
  }
  const op = get(w, ENCODING.op);
  const v = get(w, ENCODING.variant);
  const name =
    op === OPS2.EAU ? Object.keys(EAU).find((k) => EAU[/** @type {keyof typeof EAU} */ (k)] === v) : op === OPS2.SPEC ? Object.keys(SPEC).find((k) => SPEC[/** @type {keyof typeof SPEC} */ (k)] === v) : Object.keys(OPS2).find((k) => OPS2[/** @type {keyof typeof OPS2} */ (k)] === op);
  return `${name ?? "?"}${mods} ${a}`;
}
