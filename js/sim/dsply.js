// SPDX-License-Identifier: Apache-2.0
//
// DSPLY, the AGT display operator (DSPLY, Revision F, July 1969): it walks an image in core
// every frame, keeps the current transform, loads it into the hybrid array, and passes every
// vector's end point through the array to the vector generator.
//
// On the real AGT-30, DSPLY was a machine-language program for the DPR-2, run on interrupts
// from the vector generator, and its code is lost. Here it is JavaScript (D3, R2). It reads
// the image bit for bit as the manual defines it, and it charges the processor time each item
// would cost, so the frame takes as long as it did. The times come from documented
// instruction times where there are any (SNCOS 178 us, a multiply about 6 us, an add 4 us,
// 5.5 us of processor time per table vector) and are estimates otherwise (COST below, R2).
//
// Processor and vector generator overlap: while the beam draws one vector, the processor fetches
// and transforms the next. A vector starts when both are ready.

import { HybridArray } from "./array.js";
import { Core, decode } from "./image.js";
import { CLAMP_IN, depthIntensity, INCH_PER_FS, SHORT_US, shortStroke, vectorTime, zm } from "./vecgen.js";
import { bits, fromAngle, fromFrac, fromOnes15, hi, lo, M15, oct, toFrac } from "./words.js";

/**
 * Processor time per item, in microseconds. "doc" values are documented; the rest are estimates
 * built from the DPR-2's instruction times (about 3-4 us an instruction, 6 us a multiply) and an
 * instruction count (R2).
 */
export const COST = {
  /** a MOVE or DRAW item: fetch, decode, load x y z into the array, start the vector (est) */
  vectorItem: 12,
  /** one vector of a table (doc: SRM5 p. 2, "5.5 us of required processor time") */
  tableVector: 5.5,
  /** SNCOS, sine and cosine of an angle (doc: PRM1 SNCOS, "at most 178 us") */
  sncos: 178,
  /** a multiplication on the EAU (doc: SRM5 DPR3 p. 5, 4-10 us; CCT21c "6 us") */
  mul: 6,
  /** an addition (doc: SRM5 DPR3 p. 1) */
  add: 4,
  /** fetching and dispatching any item (est) */
  decode: 8,
  /** loading one array register over the transfer bus (est: one instruction) */
  arrayLoad: 3,
  /** saving or restoring the transform: 16 words copied (est) */
  saveTransform: 64,
};

/** The standard picture scales (DSPLY p. 33): a full-scale cube can turn about its centre in the visible square. */
export const PS3D = toFrac(1 / (1 + Math.sqrt(3)));
export const PS2D = toFrac(1 / (1 + Math.SQRT2));

/**
 * The pen-hit table in core (DSPLY p. 30: "a circular table with 16 entries", read by PENHT). Its
 * layout is ours: the number of hits so far (modulo 2^15), then 16 entries of two words, the
 * item seen and the image it was seen in. (R11) The monitor names it PHT.
 */
export const PEN_TABLE = 0o77600;

/** Status Register bits (DSPLY pp. 27-29), numbered from the left of the 15-bit register. */
export const SR = { SC0: 0, SC1: 1, VEL0: 2, VEL1: 3, PE: 4, WE: 5, FLAG1: 6, FLAG2: 7, PD: 8 };

/**
 * A stroke of the beam, as the scope draws it: times in microseconds from the start of the run,
 * positions in inches from the centre of the screen.
 * @typedef {object} Seg
 * @property {number} t0
 * @property {number} t1
 * @property {number} x0
 * @property {number} y0
 * @property {number} x1
 * @property {number} y1
 * @property {number} i0 intensity at the start, 0..1 (depth cueing)
 * @property {number} i1 intensity at the end
 * @property {boolean} vis drawn (true) or a move with the beam blanked
 * @property {number} item the address of the image item that made it
 * @property {[number, number, number]} [inp] the x, y, z half-words that went into the array
 * @property {Record<import("./array.js").RegName, number>} [regs] the array's registers then (shared until they change)
 */

/**
 * @typedef {object} Transform
 * @property {number} s
 * @property {number[]} R row-major 3 x 3
 * @property {number[]} d
 */

/**
 * @typedef {object} FrameResult
 * @property {Seg[]} segs times relative to the start of the frame
 * @property {number} end when the last vector ends (us)
 * @property {number} cpu processor time spent (us)
 * @property {number} vectors drawn and moved
 * @property {number} drawn visible vectors
 * @property {number} items items interpreted
 * @property {boolean} cut stopped at the frame's end (CUT)
 * @property {string[]} errors
 */

/**
 * A JavaScript stand-in for a machine-language subroutine called by a JSR item (R13). It may
 * change the current transform (and must then reload the array, as LDTRF does, p. 31), and
 * returns the processor time it took.
 * @typedef {(ctx: { dsply: Dsply; t: Transform; item: number }) => number} Subroutine
 */

/**
 * Runs DPR-2 code called by a JSR item (D4): the routine at an address, entered as JPSR enters
 * it. Returns the processor time it took, or null when it did not return.
 * @typedef {(addr: number) => number | null} MachineCall
 */

const IDENTITY = () => ({ s: fromFrac(0o37777), R: [1, 0, 0, 0, 1, 0, 0, 0, 1], d: [0, 0, 0] });

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
function mul3(a, b) {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

/**
 * The rotation matrix about one axis.
 * @param {"X" | "Y" | "Z"} axis
 * @param {number} a radians
 * @returns {number[]}
 */
export function rot(axis, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === "X") return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === "Y") return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/**
 * The three rotations of RXYZ and LDRV: "the Z-rotation is performed first, then the Y-rotation
 * relative to the new Y-axis, and finally the X-rotation relative to the new X-axis" (p. 5).
 * @param {number} az
 * @param {number} ax
 * @param {number} ay
 * @returns {number[]}
 */
export const rotZYX = (az, ax, ay) => mul3(mul3(rot("Z", az), rot("Y", ay)), rot("X", ax));

/** The deepest nesting of sub-images (FJCC68 p. 755). */
export const MAX_DEPTH = 16;

export class Dsply {
  /**
   * @param {Core} core
   * @param {HybridArray} array
   */
  constructor(core, array) {
    this.core = core;
    this.array = array;
    /** The overall picture scale, a half-word (3DPS initially, p. 22). */
    this.ps = PS3D;
    /** VIEW (FRONT, BACK, DIM): half-words; initially 37777, 40000, 0 (p. 9). */
    this.view = { front: 0o37777, back: 0o40000, dim: 0 };
    /** The depth parameters in force while a frame is drawn: VIEW's, until a DEPTH item changes
     * them "for display of following part of the image" (p. 38); each frame starts from VIEW's. */
    this.depth = { ...this.view };
    /** The Status Register, 15 bits. */
    this.sr = 0;
    /** @type {Map<number, Subroutine>} machine-language subroutines by address */
    this.subroutines = new Map();
    /** @type {MachineCall | null} runs DPR-2 code for a JSR item whose routine has no stand-in */
    this.machine = null;
    /** The light pen: where it points (inches) and whether its fingertip switch is pressed. */
    this.pen = { x: 0, y: 0, pressed: false, aperture: 0.15 };
    /** @type {{ item: number; image: number }[]} the pen-hit table, newest last (16 entries, p. 30) */
    this.penHits = [];
    /** @type {{ x: number; y: number; z?: number; zf?: number }} the beam (inches; z also as a fraction), where the last vector left it */
    this.beam = { x: 0, y: 0 };
    /** The current transform during a frame (for subroutines). */
    this.t = IDENTITY();
    /** @type {Record<import("./array.js").RegName, number> | null} the array's registers as last loaded (a snapshot, for the strokes) */
    this.regSnap = null;
    /** @type {[number, number, number] | null} the last inputs to the array */
    this.lastInp = null;
  }

  /** Back to DSPLY's initial state (p. 9), as when it is loaded: RESET! (R9). */
  reset() {
    this.ps = PS3D;
    this.view = { front: 0o37777, back: 0o40000, dim: 0 };
    this.depth = { ...this.view };
    this.sr = 0;
    this.penHits = [];
  }

  /**
   * A Status Register bit.
   * @param {number} k
   * @returns {boolean}
   */
  srBit(k) {
    return ((this.sr >> (14 - k)) & 1) === 1;
  }

  /**
   * @param {number} k
   * @param {boolean} v
   */
  setSr(k, v) {
    const m = 1 << (14 - k);
    this.sr = v ? this.sr | m : this.sr & ~m & M15;
  }

  /**
   * Loads the current transform into the array (as LDTRF does) and returns the time it took.
   * @param {Transform} t
   * @returns {number}
   */
  loadArray(t) {
    const names = /** @type {const} */ (["R11", "R12", "R13", "R21", "R22", "R23", "R31", "R32", "R33"]);
    let n = 0;
    /** @param {import("./array.js").RegName} name @param {number} half */
    const put = (name, half) => {
      if (this.array.reg[name] === half) return;
      this.array.load(name, half);
      n++;
    };
    const before = this.regSnap;
    names.forEach((r, i) => put(r, toFrac(t.R[i])));
    put("SC", toFrac(t.s));
    put("DX", toFrac(t.d[0]));
    put("DY", toFrac(t.d[1]));
    put("DZ", toFrac(t.d[2]));
    put("PS", this.ps);
    if (n || !before) this.regSnap = { ...this.array.reg };
    // only the registers that changed are loaded
    return n * COST.arrayLoad;
  }

  /**
   * Interprets an image once: one frame.
   * @param {number} image address of the image's header
   * @param {{ budget?: number; cut?: boolean; maxTime?: number }} [opts] budget: the frame's
   *   length; cut: stop at the budget (CUT); maxTime: give up after this long (an image that
   *   never ends)
   * @returns {FrameResult}
   */
  frame(image, opts = {}) {
    const budget = opts.budget ?? Infinity;
    const maxTime = opts.maxTime ?? 1e6;
    const core = this.core;
    /** @type {Seg[]} */
    const segs = [];
    /** @type {string[]} */
    const errors = [];
    this.depth = { ...this.view };
    let cpuT = 0;
    let vgT = 0;
    let cpuBusy = 0;
    let vectors = 0;
    let drawn = 0;
    let items = 0;
    let cut = false;
    let penSeen = false;
    /** @param {number} us */
    const spend = (us) => {
      cpuT += us;
      cpuBusy += us;
    };

    let t = IDENTITY();
    this.t = t;
    spend(this.loadArray(t));
    let pc = image + 2;
    let imageAt = image;
    /** @type {{ ret: number; t: Transform; loop: { start: number; count: number } | null; image: number }[]} */
    const calls = [];
    /** @type {{ t: Transform; loop: { start: number; count: number } | null }[]} */
    const saved = [];
    /** @type {{ start: number; count: number } | null} */
    let loop = null;

    /**
     * Sends one vector to the vector generator. Positions in inches; z as a fraction.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {boolean} visible
     * @param {number} item
     * @param {number} prep processor time to prepare it
     * @param {boolean} [short] a short-vector table: one every 5 us, poor beyond 0.5 in
     * @returns {boolean} false when the frame is cut
     */
    const vector = (x, y, z, visible, item, prep, short = false) => {
      spend(prep);
      x = Math.max(-CLAMP_IN, Math.min(CLAMP_IN, x));
      y = Math.max(-CLAMP_IN, Math.min(CLAMP_IN, y));
      const from = this.beam;
      const zIn = z * INCH_PER_FS;
      const len = Math.max(Math.abs(x - from.x), Math.abs(y - from.y), Math.abs(zIn - (from.z ?? 0)));
      let bright = 1;
      if (short) {
        const s = shortStroke(len);
        x = from.x + (x - from.x) * s.reach;
        y = from.y + (y - from.y) * s.reach;
        bright = s.bright;
      }
      const dur = short ? SHORT_US : vectorTime(len, visible);
      const start = Math.max(cpuT, vgT);
      if (start + dur > budget && opts.cut) {
        cut = true;
        return false;
      }
      // VIEW or a DEPTH item may have changed the depth parameters
      const front = fromFrac(this.depth.front);
      const back = fromFrac(this.depth.back);
      const dim = Math.max(0, fromOnes15(this.depth.dim)) / 0o37777;
      const z0 = from.zf ?? 0;
      const m0 = zm(z0, front, back);
      const m1 = zm(z, front, back);
      /** @param {number} f0 @param {number} f1 @param {boolean} vis */
      const piece = (f0, f1, vis) => {
        const lerp = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ u) => a + (b - a) * u;
        const ma = lerp(m0, m1, f0);
        const mb = lerp(m0, m1, f1);
        segs.push({
          t0: start + dur * f0,
          t1: start + dur * f1,
          x0: lerp(from.x, x, f0),
          y0: lerp(from.y, y, f0),
          x1: lerp(from.x, x, f1),
          y1: lerp(from.y, y, f1),
          i0: vis ? bright * depthIntensity(Math.min(ma, 1), dim) : 0,
          i1: vis ? bright * depthIntensity(Math.min(mb, 1), dim) : 0,
          vis,
          item,
          inp: this.lastInp ?? undefined,
          regs: this.regSnap ?? undefined,
        });
      };
      // dash mode (SR's visual element field 10, DSPLY p. 28): the beam is switched on and off
      // along the line, about ten dashes an inch (the spacing is ours, R12)
      const dashed = this.srBit(SR.VEL0) && !this.srBit(SR.VEL1);
      const screenLen = Math.hypot(x - from.x, y - from.y);
      const plain = piece;
      /** @param {number} f0 @param {number} f1 @param {boolean} vis */
      const emit = (f0, f1, vis) => {
        if (!dashed || !vis) return plain(f0, f1, vis);
        const n = Math.max(1, Math.round(((f1 - f0) * screenLen) / 0.1));
        for (let k = 0; k < n; k++) {
          const a = f0 + ((f1 - f0) * k) / n;
          const b = f0 + ((f1 - f0) * (k + 1)) / n;
          plain(a, (a + b) / 2, true);
          plain((a + b) / 2, b, false);
        }
      };
      if (!visible || (m0 > 1 && m1 > 1)) emit(0, 1, false);
      else if (m0 <= 1 && m1 <= 1) emit(0, 1, true);
      else {
        // the z cut-off crosses this vector: blank the part in front of it (FJCC68 p. 754)
        const u = (1 - m0) / (m1 - m0);
        if (m0 <= 1) {
          emit(0, u, true);
          emit(u, 1, false);
        } else {
          emit(0, u, false);
          emit(u, 1, true);
        }
      }
      vectors++;
      if (visible) {
        drawn++;
        if (!penSeen && this.pen.pressed && this.srBit(SR.PE) && near(this.pen, from.x, from.y, x, y)) {
          penSeen = true;
          this.setSr(SR.PD, true);
          this.penHits.push({ item, image: imageAt });
          if (this.penHits.length > 16) this.penHits.shift();
          // the pen-hit table in core, a circular table of 16 entries (DSPLY p. 30): its layout is
          // ours, a count of hits so far, then item and image for each entry
          const n = core.read(PEN_TABLE) & M15;
          core.write(PEN_TABLE + 1 + 2 * (n & 15), item);
          core.write(PEN_TABLE + 2 + 2 * (n & 15), imageAt);
          core.write(PEN_TABLE, (n + 1) & M15);
        }
      }
      this.beam = { x, y, z: zIn, zf: z };
      vgT = start + dur;
      cpuT = start;
      return true;
    };

    /**
     * A point through the array.
     * @param {number} xh
     * @param {number} yh
     * @param {number} zh
     * @returns {[number, number, number]} inches, inches, fraction
     */
    const through = (xh, yh, zh) => {
      this.lastInp = [xh, yh, zh];
      const [X, Y, Z] = this.array.transform(xh, yh, zh);
      return [X * INCH_PER_FS, Y * INCH_PER_FS, Z];
    };

    /** @param {string} msg */
    const fail = (msg) => {
      // ERRORI = SKIP (the default, p. 8): report, and skip the rest of this sub-image
      errors.push(msg);
      if (!calls.length) {
        pc = -1;
        return false;
      }
      const c = /** @type {typeof calls[number]} */ (calls.pop());
      pc = c.ret;
      t = c.t;
      this.t = t;
      loop = c.loop;
      imageAt = c.image;
      spend(this.loadArray(t));
      return true;
    };

    /**
     * Displays a chain of 2D tables (2DTBL, 2DTF, 2DLST; pp. 17-18).
     * @param {number} L
     * @param {"3d" | "short" | "graph"} kind
     * @param {number} item
     * @returns {boolean}
     */
    const tables = (L, kind, item) => {
      let tbl = L;
      for (let guard = 0; tbl && guard < 4096; guard++) {
        const head = core.read(tbl);
        const fz = hi(head);
        for (let a = tbl + 1; ; a++) {
          const w = core.read(a);
          const fx = from14(bits(w, 0, 13));
          const eol = bits(w, 14, 14) === 1;
          const fy = from14(bits(w, 15, 28));
          const d = bits(w, 29, 29) === 1;
          let ok;
          if (kind === "graph") {
            this.lastInp = null;
            ok = vector(fx * CLAMP_IN, fy * CLAMP_IN, 0, d, item, COST.tableVector);
          }
          else {
            const [X, Y, Z] = through(toFrac(fx), toFrac(fy), fz);
            ok = vector(X, Y, Z, d, item, COST.tableVector, kind === "short");
          }
          if (!ok) return false;
          if (eol || a - tbl > 0o77777) break;
        }
        tbl = lo(head);
      }
      return true;
    };

    for (;;) {
      if (cpuT > maxTime) {
        errors.push(`image did not end within ${maxTime / 1000} ms`);
        break;
      }
      if (cut) break;
      const d = decode(core, pc);
      items++;
      const at = pc;
      pc += d.len;
      const a = d.args;
      const F = (/** @type {number} */ i) => fromFrac(a[i]);
      const A = (/** @type {number} */ i) => fromAngle(a[i]);
      if (!d.def) {
        if (!fail(`image item error at ${oct(at, 5)}: operation ${d.name}`)) break;
        continue;
      }
      const name = d.def.name;
      /** Applies a change of transform and reloads the array. @param {number} us */
      const transformed = (us) => {
        spend(COST.decode + us);
        spend(this.loadArray(t));
      };
      switch (name) {
        case "MOVE":
        case "DRAW": {
          const [X, Y, Z] = through(a[1], a[2], a[0]);
          if (!vector(X, Y, Z, name === "DRAW", at, COST.vectorItem)) break;
          break;
        }
        case "2DTBL":
        case "2DTF":
        case "2DLST":
          spend(COST.decode);
          tables(a[0], name === "2DTF" ? "short" : name === "2DLST" ? "graph" : "3d", at);
          break;
        case "SCL":
          t.s *= F(0);
          transformed(COST.mul);
          break;
        case "ROTX":
        case "ROTY":
        case "ROTZ":
          t.R = mul3(t.R, rot(/** @type {"X" | "Y" | "Z"} */ (name[3]), A(0)));
          transformed(COST.sncos + 12 * COST.mul + 6 * COST.add);
          break;
        case "RXYZ":
          t.R = mul3(t.R, rotZYX(A(0), A(1), A(2)));
          transformed(3 * COST.sncos + 36 * COST.mul + 18 * COST.add);
          break;
        case "DX":
        case "DY":
        case "DZ":
        case "DV": {
          const v = name === "DV" ? [F(1), F(2), F(0)] : name === "DX" ? [F(0), 0, 0] : name === "DY" ? [0, F(0), 0] : [0, 0, F(0)];
          for (let i = 0; i < 3; i++) t.d[i] += t.s * (t.R[i * 3] * v[0] + t.R[i * 3 + 1] * v[1] + t.R[i * 3 + 2] * v[2]);
          transformed(name === "DV" ? 12 * COST.mul + 9 * COST.add : 6 * COST.mul + 3 * COST.add);
          break;
        }
        case "LDSCL":
          t.s = F(0);
          transformed(0);
          break;
        case "LDRX":
        case "LDRY":
        case "LDRZ":
          t.R = rot(/** @type {"X" | "Y" | "Z"} */ (name[3]), A(0));
          transformed(COST.sncos);
          break;
        case "LDRV":
          t.R = rotZYX(A(0), A(1), A(2));
          transformed(3 * COST.sncos + 18 * COST.mul);
          break;
        case "LDX":
        case "LDY":
        case "LDZ":
          t.d["XYZ".indexOf(name[2])] = F(0);
          transformed(0);
          break;
        case "LDV":
          t.d = [F(1), F(2), F(0)];
          transformed(0);
          break;
        case "LDI":
          t = IDENTITY();
          this.t = t;
          transformed(0);
          break;
        case "NUL":
          spend(COST.decode);
          break;
        case "SAVT":
          saved.push({ t: { s: t.s, R: [...t.R], d: [...t.d] }, loop });
          spend(COST.decode + COST.saveTransform);
          break;
        case "REST": {
          const s = saved.pop();
          if (!s) {
            if (!fail(`REST without SAVT at ${oct(at, 5)}`)) break;
            continue;
          }
          t = s.t;
          this.t = t;
          loop = s.loop;
          transformed(COST.saveTransform);
          break;
        }
        case "IMG":
          if (calls.length >= MAX_DEPTH) {
            if (!fail(`sub-images nested deeper than ${MAX_DEPTH} at ${oct(at, 5)}`)) break;
            continue;
          }
          calls.push({ ret: pc, t: { s: t.s, R: [...t.R], d: [...t.d] }, loop, image: imageAt });
          loop = null;
          imageAt = a[0];
          pc = a[0] + 2;
          spend(COST.decode + 6 * COST.add);
          break;
        case "RET": {
          spend(COST.decode);
          const c = calls.pop();
          if (!c) {
            pc = -1;
            break;
          }
          pc = c.ret;
          t = c.t;
          this.t = t;
          loop = c.loop;
          imageAt = c.image;
          spend(this.loadArray(t));
          break;
        }
        case "LOOP":
          loop = { start: pc, count: Math.max(1, fromOnes15(a[0])) };
          spend(COST.decode);
          break;
        case "ENDL":
          spend(COST.decode);
          if (loop && --loop.count > 0) pc = loop.start;
          else loop = null;
          break;
        case "JMP":
          pc = a[0];
          spend(COST.decode);
          break;
        case "JSR":
        case "CJSR":
        case "CJMP": {
          spend(COST.decode);
          if (name !== "JSR") {
            const c = d.field;
            const hit = ((c & 4) && this.srBit(SR.FLAG1)) || ((c & 2) && this.srBit(SR.FLAG2)) || ((c & 1) && this.srBit(SR.PD));
            if (!hit) break;
            if (name === "CJMP") {
              pc = a[0];
              break;
            }
          }
          const sub = this.subroutines.get(a[0]);
          if (sub) {
            this.t = t;
            spend(sub({ dsply: this, t, item: at }));
            t = this.t;
            break;
          }
          const us = this.machine ? this.machine(a[0]) : null;
          if (us === null) {
            if (!fail(`no subroutine at ${oct(a[0], 5)} (item ${oct(at, 5)})`)) break;
            continue;
          }
          spend(us);
          break;
        }
        case "LDMB":
          this.sr = (((a[0] >> 7) & 0o377) << 7) | (this.sr & 0o177);
          if (this.srBit(SR.PE)) this.setSr(SR.PD, false);
          spend(COST.decode);
          break;
        case "ORMB":
          this.sr |= ((a[0] >> 7) & 0o377) << 7;
          if (((a[0] >> 7) & 0o377) & (1 << (7 - SR.PE))) this.setSr(SR.PD, false);
          spend(COST.decode);
          break;
        case "ANDMB":
          this.sr &= ((((a[0] >> 7) & 0o377) << 7) | 0o177) & M15;
          spend(COST.decode);
          break;
        case "LDSN": {
          const w = d.full[0] ?? a[0];
          this.setSr(SR.FLAG1, bits(w, 0, 0) === 1);
          this.setSr(SR.FLAG2, bits(w, 15, 15) === 1);
          spend(COST.decode);
          break;
        }
        case "LDLS": {
          const w = d.full[0] ?? a[0];
          this.setSr(SR.FLAG1, hi(w) !== 0);
          this.setSr(SR.FLAG2, lo(w) !== 0);
          spend(COST.decode);
          break;
        }
        case "DEPTH":
          this.depth = { front: a[0], back: a[1], dim: a[2] };
          spend(COST.decode);
          break;
        case "LDPS":
          this.ps = a[0];
          transformed(0);
          break;
        default:
          // items of other models and options (AGT/50 tables, LCG1 labels, HWD1 windows)
          if (!fail(`${name} at ${oct(at, 5)} needs ${d.def.only ?? "an option"}, which this AGT-30 lacks`)) break;
          continue;
      }
      if (pc < 0) break;
    }
    return { segs, end: Math.max(vgT, cpuT), cpu: cpuBusy, vectors, drawn, items, cut, errors };
  }
}

/**
 * A 14-bit one's-complement fraction (table words, p. 18) as a number.
 * @param {number} v
 * @returns {number}
 */
export function from14(v) {
  return (v & 0o20000 ? -(~v & 0o37777) : v) / 0o20000;
}

/**
 * Whether the light pen sees a stroke: its aperture is within reach of the segment.
 * @param {{ x: number; y: number; aperture: number }} pen
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {boolean}
 */
function near(pen, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  const u = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((pen.x - x0) * dx + (pen.y - y0) * dy) / l2));
  return Math.hypot(pen.x - (x0 + u * dx), pen.y - (y0 + u * dy)) <= pen.aperture;
}

