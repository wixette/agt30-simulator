// SPDX-License-Identifier: Apache-2.0
//
// The acceptance checks of the model: words, the image format, the array, the vector
// generator, DSPLY, the processor, the monitor, the assembler, the Teletype and the programs
// (design/v0.0.1.md, section 4). Each check's expected values come from the documents, or from
// a decision when the value is ours, and say which.

import { assemble } from "../sim/adept.js";
import { USER_AT } from "../sim/agt.js";
import { HybridArray } from "../sim/array.js";
import { assembleOp, CHANNEL, disassemble, onesAdd, OPS, PIPVT, TIME } from "../sim/dpr2.js";
import { MAX_DEPTH, rotZYX } from "../sim/dsply.js";
import { framesPerSecond, tickUs } from "../sim/frameclock.js";
import { AM, BY_NAME, COND, CONDITION, Core, decode, DT, WINDOW } from "../sim/image.js";
import { Teletype } from "../sim/teletype.js";
import { vectorTime } from "../sim/vecgen.js";
import { bits, fromAngle, fromFrac, fromOnes15, hi, lo, oct, toFrac, toOnes15, word } from "../sim/words.js";
import { packText } from "../sim/amoscode.js";
import { equal, load, near, ok, typeAndRun } from "./check.js";

/** @typedef {import("./check.js").Check} Check */
/** @typedef {import("../sim/agt.js").Agt30} Agt30 */

/** One unit in the last place of a 15-bit fraction. */
const LSB = 1 / 0o40000;

/**
 * Assembles a test image into the operator's area and shows it.
 * @param {Agt30} agt
 * @param {string} src ADEPT; its first tag is the image
 * @param {string} [statements] typed before DSPLY
 */
function show(agt, src, statements = "") {
  const r = assemble(agt.core, src, USER_AT);
  ok(r.errors.length === 0, `test image: ${r.errors.map((e) => e.message).join("; ")}`);
  if (statements) typeAndRun(agt, statements);
  agt.start(USER_AT);
  agt.advance(agt.now + 200000);
}

/**
 * The visible strokes of the last frame.
 * @param {Agt30} agt
 */
function lastFrame(agt) {
  const f = agt.frames.at(-1);
  ok(f, "no frame was drawn");
  return agt.segs.filter((s) => s.t0 >= f.start && s.t0 < f.end + 1);
}

/**
 * A disassembled word back as assembleOp's arguments.
 * @param {string} text
 * @returns {[string, number, import("../sim/dpr2.js").Mods]}
 */
function disassembleOp(text) {
  const [op, addr] = text.split(" ");
  const [m, ...mods] = op.split("'");
  return [m, parseInt(addr, 8), Object.fromEntries(mods.map((k) => [k, true]))];
}

/** @type {Check[]} */
export const MODEL_CHECKS = [
  // ---- words ----
  {
    id: "WRD-1",
    title: "One's complement: the negative of a value is its complement, and there are two zeros (DSPLY p. 15)",
    run() {
      equal(toOnes15(-1), 0o77776, "-1");
      equal(fromOnes15(0o77777), 0, "minus zero");
      equal(fromOnes15(0o40000), -0o37777, "the most negative half-word");
      equal(onesAdd(0o77776, 2, 15).sum, 1, "-1 + 2 with the end-around carry");
    },
  },
  {
    id: "WRD-2",
    title: "Fractions: full scale is 37777, minus full scale 40000 (DSPLY p. 15)",
    run() {
      equal(toFrac(0.99999), 0o37777, "full scale");
      equal(toFrac(-0.99999), 0o40000, "minus full scale");
      equal(toFrac(0.5), 0o20000, "one half");
      near(fromFrac(0o20000), 0.5, 0, "20000 back");
    },
  },
  {
    id: "WRD-3",
    title: "Angles are fractions of pi: 37777 is pi, 20000 pi/2, 57777 -pi/2 (DSPLY p. 16)",
    run() {
      near(fromAngle(0o37777), Math.PI, 2 * LSB * Math.PI, "37777");
      near(fromAngle(0o20000), Math.PI / 2, 0, "20000");
      near(fromAngle(0o57777), -Math.PI / 2, 0, "57777");
    },
  },
  {
    id: "WRD-4",
    title: "Octal, and Adage's bit numbering from the left (DSPLY p. 12)",
    run() {
      equal(oct(0o12345, 5), "12345", "octal");
      const w = word(0o40000, 1);
      equal(bits(w, 0, 0), 1, "bit 0 is the leftmost");
      equal(bits(w, 29, 29), 1, "bit 29 is the rightmost");
    },
  },

  // ---- the image format ----
  {
    id: "IMG-1",
    title: "Operation, condition, window, data type and address mode codes as the scan of DSPLY pp. 39-41 gives them",
    run() {
      // the codes are written as the manual does, values "!H": the upper half-word
      /** @type {Record<string, number>} */
      const H = {
        MOVE: 0o100, "2DTBL": 0o200, DRAW: 0o300, "2DTF": 0o400, LABLR: 0o500, "2DLST": 0o600, LABL: 0o700,
        "2DTAB": 0o1000, "2DTAF": 0o1100, "2DINT": 0o1200, "2DINF": 0o1300, "3DTAB": 0o1400, "3DTAF": 0o1500, "2DROT": 0o1600, "2DROF": 0o1700,
        SCL: 0o10000, ROTX: 0o10100, ROTY: 0o10200, ROTZ: 0o10300, RXYZ: 0o10400, DX: 0o10500, DY: 0o10600, DZ: 0o10700, DV: 0o11000,
        LDSCL: 0o20000, LDRX: 0o20100, LDRY: 0o20200, LDRZ: 0o20300, LDRV: 0o20400, LDX: 0o20500, LDY: 0o20600, LDZ: 0o20700, LDV: 0o21000, LDI: 0o21200,
        NUL: 0, SAVT: 0o30000, REST: 0o30100, RET: 0o30200, IMG: 0o30300, LOOP: 0o30400, ENDL: 0o30500, JMP: 0o30600, JSR: 0o30700, LONG: 0o31500, SHORT: 0o31600,
        LDMB: 0o50000, ORMB: 0o50100, ANDMB: 0o50200, LDSN: 0o54000, LDLS: 0o55000,
        LDW: 0o31000, MVW: 0o31100, LWS: 0o31200, DEPTH: 0o31300, LDPS: 0o31400,
      };
      for (const [name, h] of Object.entries(H)) equal((BY_NAME.get(name)?.op ?? -1) << 6, h, name);
      equal(COND.CJMP << 6, 0o56000, "CJMP'C");
      equal(COND.CJSR << 6, 0o57000, "CJSR'C");
      equal(CONDITION.FLAG1 << 6, 0o400, "FLAG1");
      equal(CONDITION.FLAG2 << 6, 0o200, "FLAG2");
      equal(CONDITION.PEN << 6, 0o100, "PEN");
      /** @type {Record<string, number>} */
      const WW = { WBX1: 0o4000, WBX2: 0o2000, WBY1: 0o1000, WBY2: 0o400, WBZ1: 0o200, WBZ2: 0o100 };
      for (const [k, h] of Object.entries(WW)) equal(WINDOW[/** @type {keyof typeof WINDOW} */ (k)] << 6, h, k);
      /** @type {Record<string, number>} */
      const D = { IHW: 0, RHW: 0o10, IFW: 0o20, RFW: 0o30, IRL: 0o60, RRL: 0o70 };
      for (const [k, h] of Object.entries(D)) equal(DT[/** @type {keyof typeof DT} */ (k)] << 3, h, k);
      /** @type {Record<string, number>} */
      const A = { I: 1, DIR: 4, IMED: 0, STR: 5 };
      for (const [k, h] of Object.entries(A)) equal(AM[/** @type {keyof typeof AM} */ (k)], h, k);
    },
  },
  {
    id: "IMG-2",
    title: "An immediate item: argument 1 in the command word, 2 and 3 in the next word's halves (DSPLY pp. 13-14)",
    run() {
      const core = new Core();
      const r = assemble(core, "T: DRAW (.5, -.25, 1)\n", 0o100);
      equal(r.errors.length, 0, "assembled");
      equal(core.read(0o100), word(0o300, 0o20000), "command word: DRAW and Z");
      equal(core.read(0o101), word(toFrac(-0.25), 1), "X and Y");
      const d = decode(core, 0o100);
      equal(d.name, "DRAW", "decoded");
      equal(d.len, 2, "two words");
    },
  },
  {
    id: "IMG-3",
    title: "The letter A is 13 vectors, 11 of them drawn (FJCC68 p. 748, Fig. 4)",
    run(ctx) {
      const agt = ctx.boot();
      load(ctx, agt, "letter-a");
      const f = agt.frames.at(-1);
      ok(f, "a frame");
      equal(f.vectors, 13, "vectors");
      equal(f.drawn, 11, "drawn");
    },
  },
  {
    id: "IMG-4",
    title: "Address modes: DIR reads a location, I follows a chain, an IRL list gives each argument its own (DSPLY pp. 14-15; R3)",
    run(ctx) {
      const agt = ctx.boot();
      show(
        agt,
        `T:  TEXT /T/; 0
             DRAW'IRL (Z0'DIR, P'I, Y0'DIR)
             RET
         Z0: 0
         Y0: .25
         P:  1!H+Q        [ A CHAIN WORD: ADDRESS MODE I, POINTING ON
         Q:  .5
        `,
      );
      const s = lastFrame(agt).find((g) => g.vis);
      ok(s, "a stroke");
      // through the standard 3D picture scale: x' = PS3D x, 10 inches to full scale
      const ps = fromFrac(agt.dsply.ps) * 10;
      near(s.x1, 0.5 * ps, 2 * LSB * 10, "x by the indirect chain");
      near(s.y1, 0.25 * ps, 2 * LSB * 10, "y by DIR");
    },
  },

  // ---- the array ----
  {
    id: "ARR-1",
    title: "x' = PS [D + SC (R x)] for every row, exact on the quantized numbers (FJCC68 eqs. 5-7; D8)",
    run() {
      const a = new HybridArray();
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 1.6 - 0.8;
      for (let n = 0; n < 50; n++) {
        for (const r of /** @type {const} */ (["R11", "R12", "R13", "R21", "R22", "R23", "R31", "R32", "R33", "SC", "DX", "DY", "DZ", "PS"])) a.load(r, toFrac(rand()));
        const x = [toFrac(rand()), toFrac(rand()), toFrac(rand())];
        const out = a.transform(x[0], x[1], x[2]);
        const v = (/** @type {import("../sim/array.js").RegName} */ k) => a.value(k);
        const R = [["R11", "R12", "R13"], ["R21", "R22", "R23"], ["R31", "R32", "R33"]];
        const D = ["DX", "DY", "DZ"];
        for (let i = 0; i < 3; i++) {
          const sum = R[i].reduce((s, k, j) => s + v(/** @type {any} */ (k)) * fromFrac(x[j]), 0);
          const want = Math.max(-1, Math.min(1, v("PS") * (v(/** @type {any} */ (D[i])) + v("SC") * sum)));
          near(out[i], want, 1e-12, `row ${i + 1}`);
        }
      }
    },
  },
  {
    id: "ARR-2",
    title: "The array turns a point as RXYZ says: Z first, then Y, then X (DSPLY p. 22)",
    run(ctx) {
      const agt = ctx.boot();
      // a point on +X, turned 90 degrees about Z, lands on +Y
      show(agt, "T: TEXT /T/; 0\n ROTZ (90DEG)\n DRAW (0, .5, 0)\n RET\n");
      const s = lastFrame(agt).find((g) => g.vis);
      ok(s, "a stroke");
      const ps = fromFrac(agt.dsply.ps) * 10;
      near(s.x1, 0, 3 * LSB * 10, "x");
      near(s.y1, 0.5 * ps, 3 * LSB * 10, "y");
    },
  },

  // ---- the vector generator ----
  {
    id: "VG-1",
    title: "Vectors per 40-frame (25,000 us): 1,660 of 3 in, 800 of 7 in, 640 of 10 in, 2,940 of 1 in (SRM5 AVG1 pp. 1-2)",
    run() {
      for (const [len, n] of [[3, 1660], [7, 800], [10, 640], [1, 2940]]) near(n * vectorTime(len, true), 25000, 25000 * 0.02, `${len}-inch vectors`);
    },
  },
  {
    id: "VG-2",
    title: "A vector takes 5 to 39 us; a long move takes 15 us (SRM5 AVG1 p. 1)",
    run() {
      near(vectorTime(0.1, true), 5, 0.01, "the shortest");
      ok(vectorTime(10, true) <= 39.1, "the longest");
      equal(vectorTime(8, false), 15, "a long move");
    },
  },

  // ---- DSPLY ----
  {
    id: "DSP-1",
    title: "RATE 1 to 5 refresh 60, 40, 30, 24 and 20 times a second: 120 / (RATE + 1) (DSPLY p. 7)",
    run(ctx) {
      const want = [60, 40, 30, 24, 20];
      for (let rate = 1; rate <= 5; rate++) {
        equal(framesPerSecond(rate), want[rate - 1], `RATE ${rate} by the formula`);
        const agt = ctx.boot();
        typeAndRun(agt, `DSPLY (V.A, ${rate})!`);
        const from = agt.now;
        const n0 = agt.frames.length;
        agt.advance(from + 1e6);
        near(agt.frames.length - n0, want[rate - 1], 1, `RATE ${rate} measured`);
      }
    },
  },
  {
    id: "DSP-2",
    title: "A picture too big for its frame: ALL slows it, CUT cuts it, BUMP raises RATE and types it (DSPLY p. 8)",
    run(ctx) {
      for (const opt of ["ALL", "CUT", "BUMP"]) {
        const agt = ctx.boot();
        typeAndRun(agt, `OPEN (NLINES)!4000.\rDSPLY (V.RAND, 2, , ${opt})!`, 1e6);
        const f = agt.frames.at(-1);
        ok(f, "a frame");
        if (opt === "ALL") {
          ok(!f.cut && f.drawn === 4000, "ALL draws every line");
          ok(agt.stats().fps < 40 - 1, "ALL refreshes more slowly");
        } else if (opt === "CUT") {
          ok(f.cut && f.drawn < 4000, "CUT stops at the tick");
          near(agt.stats().fps, 40, 1, "CUT keeps the RATE");
        } else {
          ok(agt.rate > 2, "BUMP raised RATE");
          ok(f.drawn === 4000 && !f.late, "the picture fits at the new RATE");
          ok(agt.paper.getText().includes(`RATE ${agt.rate}`), "BUMP typed the new RATE");
        }
      }
    },
  },
  {
    id: "DSP-3",
    title: "A dial read by the CLOCK chain at the tick shows in that frame (DSPLY p. 9)",
    run(ctx) {
      const agt = ctx.boot();
      load(ctx, agt, "cube");
      agt.setDial(0, 0.25);
      const start = agt.nextTick;
      agt.advance(start + 1);
      // DIALZ holds dial 0's angle as a fraction of pi
      near(fromFrac(agt.core.read(agt.core.addr("DIALZ")) & 0o77777), 0.25, 2 * LSB, "DIALZ");
      const f = agt.frames.at(-1);
      ok(f && f.start === start, "the frame at that tick");
      const R = agt.dsply.t.R;
      near(Math.atan2(R[3], R[0]), Math.PI / 4, 0.001, "the frame's rotation about Z");
    },
  },
  {
    id: "DSP-4",
    title: "Depth cueing: at full DIM a line at z'm = 0 is 10 times dimmer than at the front, and blanked in front of FRONT (FJCC68 p. 753, Fig. 14)",
    run(ctx) {
      const agt = ctx.boot();
      show(agt, "T: TEXT /T/; 0\n MOVE (0, -.5, 0)\n DRAW (0, .5, 0)\n RET\n", "VIEW (37777, 40000, 37777)!");
      const mid = lastFrame(agt).find((g) => g.vis);
      ok(mid, "a stroke at z' = 0");
      near(mid.i0, 0.1, 0.002, "intensity at z'm = 0");
      const front = ctx.boot();
      show(front, "T: TEXT /T/; 0\n MOVE (.9, -.5, 0)\n DRAW (.9, .5, 0)\n RET\n", "VIEW (.1, 40000, 37777)!");
      ok(!lastFrame(front).some((g) => g.vis), "a line in front of FRONT is blanked");
    },
  },
  {
    id: "DSP-5",
    title: `Sub-images nest ${MAX_DEPTH} deep; deeper is an image error, typed, and the rest of that sub-image is skipped (FJCC68 p. 755; DSPLY p. 8)`,
    run(ctx) {
      /** @param {number} depth */
      const nest = (depth) => {
        let src = "";
        for (let k = 0; k < depth; k++) src += `S${k}: TEXT /S${k}/; 0\n IMG (S${k + 1})\n RET\n`;
        src += `S${depth}: TEXT /END/; 0\n MOVE (0, 0, 0)\n DRAW (0, .1, .1)\n RET\n`;
        return src;
      };
      const ok16 = ctx.boot();
      show(ok16, nest(MAX_DEPTH));
      ok(lastFrame(ok16).some((g) => g.vis), `${MAX_DEPTH} levels draw`);
      const deep = ctx.boot();
      show(deep, nest(MAX_DEPTH + 1));
      ok(!lastFrame(deep).some((g) => g.vis), "one more is refused");
      ok(/NESTED DEEPER/.test(deep.paper.getText() + deep.printQueue.map((c) => c.ch).join("")), "and typed");
    },
  },
  {
    id: "DSP-6",
    title: "SAVT and REST bracket a change of transform (DSPLY p. 24)",
    run(ctx) {
      const agt = ctx.boot();
      show(agt, "T: TEXT /T/; 0\n SAVT\n DX (.5)\n REST\n DRAW (0, 0, .5)\n RET\n");
      const s = lastFrame(agt).find((g) => g.vis);
      ok(s, "a stroke");
      near(s.x1, 0, 2 * LSB * 10, "the move along X was undone");
    },
  },

  // ---- the processor ----
  {
    id: "CPU-1",
    title: "Instruction times: 4 us from memory, 3 immediate, 3 a jump, 5 a JPSR (SRM5 DPR3 pp. 4-6)",
    run(ctx) {
      const agt = ctx.boot();
      const cpu = agt.cpu;
      const at = USER_AT;
      const prog = [assembleOp("MDAR", at + 10), assembleOp("MDAS", 1, { F: true }), assembleOp("JUMP", at + 3), assembleOp("JPSR", at + 11)];
      prog.forEach((w, i) => agt.core.write(at + i, w));
      cpu.LC = at;
      equal(cpu.step(), TIME.memory, "MDAR");
      equal(TIME.memory, 4, "memory reference");
      equal(cpu.step(), 3, "MDAS'F");
      equal(cpu.step(), 3, "JUMP");
      equal(cpu.step(), 5, "JPSR");
    },
  },
  {
    id: "CPU-2",
    title: "JPSR stores the return at A and continues at A+1; a routine takes its arguments after the call (DPR2SPI pp. 35, 51-53; AMRMX p. 3)",
    run(ctx) {
      const agt = ctx.boot();
      const r = assemble(agt.core, "S: 0\n MDAR'I S\n MDAE'I'X S\n JUMP'I'X S\nGO: JPSR S; 7; 5\n JUMP GO\n", USER_AT);
      equal(r.errors.length, 0, "assembled");
      // S adds the two words after the call: it reads them through its return address, which
      // 'X steps before each use (DPR2SPI pp. 51-53)
      const go = agt.core.addr("GO");
      agt.core.write(go + 3, assembleOp("JUMP", go + 3));
      const run = agt.cpu.run(go, go + 3, 1000);
      ok(run.done, "returned past its arguments");
      equal(agt.cpu.AR, 7 + 5, "the sum of its two arguments");
    },
  },
  {
    id: "CPU-3",
    title: "RVCD reads a dial through GDD1 and ADC5 to 1 LSB: selecting the input starts the conversion, its result is S5[15-29] (DPR2SPI p. 41; DPR2BD; R7)",
    run(ctx) {
      const agt = ctx.boot();
      for (const v of [0.3, -0.71, 0.0005, 0.999]) {
        agt.setDial(2, v);
        const r = agt.cpu.call(agt.core.addr("RVCD"), [2], USER_AT, 10000);
        ok(r.done, "returned");
        near(fromFrac(agt.cpu.AR & 0o77777), v, LSB, `dial at ${v}`);
        equal(agt.cpu.AR >= 0o4000000000, v < 0, "its sign through the whole word");
        ok(r.us < 100, `in ${r.us} us`);
      }
    },
  },
  {
    id: "CPU-4",
    title: "Instruction words as the NCSU tapes' binaries show them, and 'L takes the next word (MH25; R1)",
    run(ctx) {
      /** @type {[string, import("../sim/dpr2.js").Mods, number][]} */
      const words = [
        ["MDAR", {}, 0o21000], ["ARMD", {}, 0o20100], ["MDAR", { I: true, X: true }, 0o21003], ["MDAR", { A: true }, 0o21010],
        ["MDAR", { H: true, O: true }, 0o21064], ["ARXO", { F: true }, 0o77100], ["S5AR", { H: true, A: true, F: true }, 0o61570],
        ["MDBR", { K: true }, 0o22040], ["MDIC", { A: true }, 0o23010], ["MDIR", { X: true }, 0o24002], ["MDAE", { N: true }, 0o36014],
        ["MDAS", { F: true, N: true }, 0o75014], ["JPSR", {}, 0o20], ["JUMP", { I: true }, 0o41], ["JPAN", {}, 0o100], ["JPLS", {}, 0o140],
        ["FPRI", {}, 0o360], ["UPRI", {}, 0o340], ["ARRS", {}, 0o17440], ["MPYI", {}, 0o15440], ["DIVI", {}, 0o16440],
      ];
      for (const [m, mods, upper] of words) {
        const w = assembleOp(m, 0o123, mods);
        equal(w, upper * 0o100000 + 0o123, `${m}${Object.keys(mods).map((k) => `'${k}`).join("")}`);
        equal(assembleOp(...disassembleOp(disassemble(w))), w, `${disassemble(w)} disassembles and assembles back`);
      }
      const agt = ctx.boot();
      const at = USER_AT;
      [0o4100000000, 0o1234, assembleOp("NOOP", 0)].forEach((w, i) => agt.core.write(at + i, w));
      agt.cpu.LC = at;
      agt.cpu.step();
      equal(agt.cpu.AR, 0o1234, "MDAR'L loads the next word");
      equal(agt.cpu.LC, at + 2, "and skips it");
    },
  },

  {
    id: "CPU-5",
    title: "The special instructions' codes are Adage's (DPR2SPI p. 36, Figure 6; ADEPT71 p. 41; R1)",
    run() {
      /** @type {[string, number][]} */
      const codes = [
        ["NOOP", 0], ["JPSR", 0o20], ["JUMP", 0o40], ["JSAN", 0o60], ["JPAN", 0o100], ["JSLS", 0o120], ["JPLS", 0o140],
        ["OPTY", 0o160], ["OPCR", 0o200], ["SKUA", 0o220], ["SKLA", 0o240], ["CNVT", 0o320], ["UPRI", 0o340], ["FPRI", 0o360],
        ["OPTI", 0o460], ["PINT", 0o560], ["OPIO", 0o600], ["MPYU", 0o15400], ["DIVU", 0o16400], ["MPYL", 0o15420],
        ["DIVL", 0o16420], ["MPYI", 0o15440], ["DIVI", 0o16440], ["ARRS", 0o17440], ["ARLS", 0o17500], ["NORM", 0o17520],
        ["ERAR", 0o17540],
      ];
      for (const [m, code] of codes) equal(OPS[m], code, m);
      equal(Object.keys(OPS).length, codes.length, "and no others");
      equal(assembleOp("PULSE", 0), assembleOp("OPCR", 0), "PULSE, as the NCSU sources name it, is OPCR's code");
      equal(assembleOp("ANAR", 0o123), 0o01260 * 0o100000 + 0o123, "ANAR, a conditional transfer (C13)");
      equal(assembleOp("LSIR", 0o123), 0o04300 * 0o100000 + 0o123, "LSIR (C14)");
    },
  },
  {
    id: "CPU-6",
    title: "AN is AR[0] set and LS is AR[15-29] not +0, so -0 is both; ANXO takes an absolute value (DPR2SPI pp. 37-38)",
    run(ctx) {
      const agt = ctx.boot();
      const cpu = agt.cpu;
      const at = USER_AT;
      const run = (/** @type {number} */ ar, /** @type {number} */ ins) => {
        agt.core.write(at, ins);
        agt.core.write(at + 1, assembleOp("NOOP", 0));
        cpu.AR = ar;
        cpu.LC = at;
        cpu.step();
        return cpu.LC;
      };
      equal(run(0o7777777777, assembleOp("JPAN", at + 5)), at + 5, "JPAN jumps on -0");
      equal(run(0o7777777777, assembleOp("JPLS", at + 5)), at + 5, "JPLS jumps on -0: its lower half is not +0");
      equal(run(0o7777700000, assembleOp("JPLS", at + 5)), at + 1, "JPLS does not jump on a lower half of +0");
      equal(run(5, assembleOp("JPAN", at + 5)), at + 1, "JPAN does not jump on a positive AR");
      equal(onesAdd(1, 0o7777777776, 30).sum, 0o7777777777, "1 - 1 is -0");
      // the manual's example: ANXO MM, with -0 in MM, complements AR if it is negative
      agt.core.write(at + 2, 0o7777777777);
      equal(run(0o7777777772, assembleOp("ANXO", at + 2)) && cpu.AR, 5, "ANXO: |-5| is 5");
      equal(run(5, assembleOp("ANXO", at + 2)) && cpu.AR, 5, "and |5| is 5");
    },
  },
  {
    id: "CPU-7",
    title: "AS adds the operand's lower half, its sign extended, to all of AR; 'F's operand is the instruction itself; JPSR keeps the word's upper half (DPR2SPI pp. 24, 30, 35)",
    run(ctx) {
      const agt = ctx.boot();
      const cpu = agt.cpu;
      const at = USER_AT;
      const step = (/** @type {number[]} */ words, /** @type {number} */ ar) => {
        words.forEach((w, i) => agt.core.write(at + i, w));
        cpu.AR = ar;
        cpu.LC = at;
        cpu.step();
      };
      step([assembleOp("MDAS", 1, { F: true, N: true })], 0o0000100000);
      equal(cpu.AR, 0o0000077777, "MDAS'F'N 1 subtracts 1 from all of AR: a borrow from the upper half");
      step([assembleOp("MDAS", 0o40000, { F: true })], 0);
      equal(cpu.AR, 0o7777740000, "an operand of 40000 is negative");
      const w = assembleOp("MDBR", 0o1234, { F: true });
      step([w], 0);
      equal(cpu.BR, w, "MDBR'F BETA puts the instruction MDBR'F BETA into BR");
      agt.core.write(at + 5, assembleOp("JUMP", 0));
      step([assembleOp("JPSR", at + 5)], 0);
      equal(agt.core.read(at + 5), assembleOp("JUMP", at + 1), "JPSR leaves JUMP in the word and sets its address to the return");
      equal(cpu.LC, at + 6, "and continues after it");
    },
  },
  {
    id: "CPU-8",
    title: "Indirect addresses chain while each word has 'I; 'X increments the word it points to before it is read (DPR2SPI pp. 32-33)",
    run(ctx) {
      const agt = ctx.boot();
      const cpu = agt.cpu;
      const at = USER_AT;
      const [alpha, beta, gamma, delta, kappa] = [at, at + 10, at + 11, at + 12, at + 20];
      // the manual's example: ALPHA = OPER'I BETA, BETA = OPER'I'X GAMMA, GAMMA = OPER'I DELTA,
      // DELTA+1 = OPER KAPPA; the effective argument is (KAPPA)
      agt.core.write(alpha, assembleOp("MDAR", beta, { I: true }));
      agt.core.write(beta, assembleOp("NOOP", gamma, { I: true, X: true }));
      agt.core.write(gamma, assembleOp("NOOP", delta, { I: true }));
      agt.core.write(delta + 1, assembleOp("NOOP", kappa));
      agt.core.write(kappa, 0o1234567);
      cpu.LC = alpha;
      cpu.step();
      equal(cpu.AR, 0o1234567, "(KAPPA) is the argument");
      equal(agt.core.read(gamma), assembleOp("NOOP", delta + 1, { I: true }), "GAMMA became OPER'I DELTA+1");
      // 'X without 'I: the word is incremented, then read
      agt.core.write(alpha, assembleOp("MDAR", beta + 2, { X: true }));
      agt.core.write(beta + 2, 0o77);
      cpu.LC = alpha;
      cpu.step();
      equal(cpu.AR, 0o100, "MDAR'X reads the word as incremented");
    },
  },
  {
    id: "CPU-9",
    title: "The EAU: a product in AR[0-28], its sign repeated in AR[29]; a quotient in AR[15-29], the remainder in AR[0-14] (DPR2SPI pp. 43-45, the manual's examples)",
    run(ctx) {
      const agt = ctx.boot();
      const cpu = agt.cpu;
      const at = USER_AT;
      /** @type {[string, number, number, number, number][]} op, AR, operand word, address, result */
      const cases = [
        ["MPYU", 0o32173, word(0o25406, 0), 0, word(0o21507, 0o43704)],
        ["MPYL", 0o57467, 0o33505, 0, word(0o61660, 0o62057)],
        ["MPYI", 0o24663, 0, 0o53101, word(0o62315, 0o42113)],
        ["DIVU", word(0o50521, 0o66733), word(0o32440, 0), 0, word(0o25444, 0o43703)],
        ["DIVL", word(0o74323, 0o64575), 0o06242, 0, word(0o04652, 0o55651)],
      ];
      for (const [op, ar, operand, imm, want] of cases) {
        agt.core.write(at + 10, operand);
        agt.core.write(at, assembleOp(op, imm || at + 10));
        cpu.AR = ar;
        cpu.LC = at;
        cpu.step();
        equal(oct(cpu.AR), oct(want), op);
      }
    },
  },
  {
    id: "CPU-10",
    title: "PINT requests priority channel 14, served as JPSR'I PIPVT (DPR2SPI p. 40; DPR2BD; the pivot's address is ours, R10)",
    run(ctx) {
      const agt = ctx.boot();
      const cpu = agt.cpu;
      const at = USER_AT;
      agt.core.write(PIPVT, at + 10);
      agt.core.write(at, assembleOp("PINT", 0));
      agt.core.write(at + 1, assembleOp("NOOP", 0));
      cpu.LC = at;
      cpu.step();
      ok(cpu.pri.pending.has(CHANNEL.PINT), "a request on channel 14");
      cpu.step();
      equal(cpu.LC, at + 11, "served: the subroutine at the pivot's address is entered");
      equal(lo(agt.core.read(at + 10)), at + 1, "and given the return");
    },
  },

  // ---- the operator's control panel (R21) ----
  {
    id: "OCP-1",
    title: "PULSE 1 at the usual setting, MDIR 77776, returns to the monitor: the program stops and the display halts (MH26; R10)",
    run(ctx) {
      const agt = ctx.boot();
      equal(agt.panel.pri, word(0o24000, 0o77776), "the PRI switches' usual setting");
      equal(disassemble(agt.panel.pri), "MDIR 77776", "decodes as MDIR 77776");
      agt.core.write(USER_AT, assembleOp("JUMP", USER_AT));
      agt.startProgram(USER_AT, 0o67777, "LOOP");
      agt.start(/** @type {number} */ (agt.core.symbols.get("V.CUBE")));
      agt.advance(agt.now + 100000);
      ok(agt.program && agt.image !== null, "a program runs and a picture is shown");
      equal(agt.setPulse1(true), "monitor", "PULSE 1");
      agt.setPulse1(false);
      ok(agt.program === null, "the program stopped");
      ok(agt.image === null, "the display halted");
    },
  },
  {
    id: "OCP-2",
    title: "The PRI switches read and write core through BR: MDBR X shows a word, BRMD X stores BR's buttons (SRM5 DPR3 p. 13)",
    run(ctx) {
      const agt = ctx.boot();
      const p = agt.panel;
      agt.core.write(USER_AT, word(0o12345, 0o54321));
      p.setPri(assembleOp("MDBR", USER_AT));
      equal(agt.setPulse1(true), "served", "PULSE 1");
      agt.setPulse1(false);
      equal(agt.cpu.BR, word(0o12345, 0o54321), "BR shows the word");
      p.resetBR();
      for (const bit of [0, 14, 29]) p.pressBR(bit);
      p.setPri(assembleOp("BRMD", USER_AT + 1));
      agt.setPulse1(true);
      equal(agt.core.read(USER_AT + 1), word(0o40001, 0o00001), "the word at X is BR's buttons");
    },
  },
  {
    id: "OCP-3",
    title: "HALT stops the processor: no frames, the keyboard waits, PULSE 1 waits lit; RUN goes on from the next tick (SRM5 DPR3 p. 13)",
    run(ctx) {
      const agt = ctx.boot();
      const p = agt.panel;
      agt.start(/** @type {number} */ (agt.core.symbols.get("V.CUBE")));
      agt.advance(agt.now + 100000);
      p.halt();
      const n = agt.frames.length;
      agt.type("HALT!");
      agt.advance(agt.now + 2000000);
      equal(agt.frames.length, n, "no frame while halted");
      ok(agt.sending.length > 0, "the characters typed wait");
      equal(agt.setPulse1(true), "halted", "PULSE 1 while halted");
      ok(p.pulse1Lit, "its lamp is lit");
      p.setPri(assembleOp("NOOP", 0));
      p.run();
      ok(!p.pulse1Lit, "served at RUN");
      agt.advance(agt.now + 100000);
      ok(agt.frames.length - n <= Math.ceil(100000 / tickUs(agt.rate)) + 1, "the frames missed are not caught up");
      for (let guard = 0; agt.busy && guard < 100; guard++) agt.advance(agt.now + 100000);
      ok(agt.image === null, "the monitor took HALT! once it ran");
    },
  },
  {
    id: "OCP-4",
    title: "STEP obeys one instruction of a halted program; CYCLE, at instruction level, does the same (SRM5 DPR3 p. 13; R21)",
    run(ctx) {
      const agt = ctx.boot();
      const p = agt.panel;
      agt.core.write(USER_AT, assembleOp("NOOP", 0));
      agt.core.write(USER_AT + 1, assembleOp("NOOP", 0));
      agt.core.write(USER_AT + 2, assembleOp("JUMP", USER_AT));
      agt.startProgram(USER_AT, 0o67777, "STEPS");
      p.halt();
      equal(p.step(), "stepped", "STEP");
      equal(agt.cpu.LC, USER_AT + 1, "one instruction");
      equal(p.cycle(), "stepped", "CYCLE");
      equal(agt.cpu.LC, USER_AT + 2, "one more");
      p.step();
      equal(agt.cpu.LC, USER_AT, "the jump");
      p.run();
      equal(p.step(), "nothing", "STEP does nothing while the processor runs");
    },
  },
  {
    id: "OCP-5",
    title: "RESET clears the registers and halts; OFF takes both buttons; ON stops in HALT with core kept (SRM5 DPR3 pp. 13-14)",
    run(ctx) {
      const agt = ctx.boot();
      const p = agt.panel;
      agt.cpu.AR = 5;
      p.pressBR(3);
      p.reset();
      equal(agt.cpu.AR + agt.cpu.BR, 0, "AR and BR cleared");
      equal(p.mode, "halt", "halted");
      p.run();
      equal(p.off(0, 0), "armed", "one OFF");
      ok(p.power, "the power stays on");
      equal(p.off(0, 3000), "armed", "the same OFF again, later");
      equal(p.off(1, 3500), "ok", "the other OFF with it");
      ok(!p.power && !p.lamps().run, "power off, lamps dark");
      const kept = agt.core.read(USER_AT);
      equal(p.on(), "halted", "ON");
      equal(p.mode, "halt", "the processor stops in HALT");
      equal(agt.core.read(USER_AT), kept, "core kept");
    },
  },

  // ---- the monitor ----
  {
    id: "MON-1",
    title: "The monitor types ? for a statement it does not know (AMRMX p. 18)",
    run(ctx) {
      const agt = ctx.boot();
      typeAndRun(agt, "FROB (1, 2)!");
      ok(/FROB \(1, 2\)!\s*\n\?/.test(agt.paper.getText()), "a ? after the echo");
    },
  },
  {
    id: "MON-2",
    title: "OPEN types the address in octal and the contents, and a value typed with a return replaces them (AMRMX p. 9)",
    run(ctx) {
      const agt = ctx.boot();
      const a = agt.core.addr("NLINES");
      typeAndRun(agt, "OPEN (NLINES)!2000.\r");
      equal(agt.core.read(a), 2000, "NLINES");
      ok(agt.paper.getText().includes(`${oct(a, 5)}: 00000 ${oct(1000, 5)} 2000.`), "the cell typed, then the value");
    },
  },
  {
    id: "MON-3",
    title: "DSPLY keeps omitted arguments; HALT stops the display (DSPLY pp. 7-8)",
    run(ctx) {
      const agt = ctx.boot();
      typeAndRun(agt, "DSPLY (V.A, 4)!DSPLY (V.CUBE)!");
      equal(agt.rate, 4, "RATE kept");
      equal(agt.image, agt.core.addr("V.CUBE"), "the new image");
      typeAndRun(agt, "HALT!");
      equal(agt.image, null, "halted");
    },
  },
  {
    id: "MON-4",
    title: "RESET returns the machine to its state at start: programs released, display halted (AMRMX p. 11; R9)",
    run(ctx) {
      const agt = ctx.boot();
      const before = agt.core.words.slice();
      load(ctx, agt, "town");
      ok(agt.core.symbols.has("TOWN"), "TOWN assembled");
      typeAndRun(agt, "RESET!");
      ok(!agt.core.symbols.has("TOWN"), "TOWN released");
      equal(agt.image, null, "display halted");
      equal(agt.clockCode.length, 0, "CLOCK chain cleared");
      ok(agt.core.words.every((w, i) => w === before[i]), "core as at start");
    },
  },
  {
    id: "MON-5",
    title: "The monitor asks the date when it is loaded, and the simulator answers it, so nothing waits on the reader (AMRMX71 p. 13; R9)",
    run(ctx) {
      const agt = ctx.boot();
      agt.advance(agt.now);
      ok(/^MO\/DA\/YR = \d\d\/\d\d\/\d\d$/.test(agt.paper.getText().trim()), `the date asked and answered: ${agt.paper.getText().trim()}`);
      load(ctx, agt, "cube");
      ok(agt.image !== null, "a program loads straight after, from the Programs menu");
    },
  },
  {
    id: "MON-6",
    title: "V! types the version line; CORE!, DEC! and OCT!; MARK! and RLSE!; * for an argument that does not evaluate (AMRMX71 pp. 7-11)",
    run(ctx) {
      const agt = ctx.boot();
      agt.advance(agt.now);
      const said = (/** @type {string} */ statement) => {
        const before = agt.paper.getText().length;
        typeAndRun(agt, statement);
        return agt.paper.getText().slice(before).split("\n").slice(1).join("\n").trim();
      };
      ok(/^STANDARD AMRMX\d \(REV\. [A-Z], [\d/]+\)$/.test(said("V!")), "STANDARD AMRMXn (REV. r, date)");
      equal(said("CORE (777)!"), "777", "CORE(ARG) in octal");
      said("DEC!");
      equal(said("CORE (777)!"), "511", "and, after DEC!, in decimal");
      said("OCT!");
      equal(said("MARK!"), "1", "MARK types its number");
      said("DEFINE (ZZ, 5)!");
      ok(agt.core.symbols.has("ZZ"), "a symbol defined after the mark");
      said("RLSE!");
      ok(!agt.core.symbols.has("ZZ"), "RLSE releases it");
      ok(said("CORE (NOSUCH)!").startsWith("*"), "an argument that does not evaluate is answered with *");
      ok(said("DELETE (NOSUCH)!").startsWith("?"), "a symbol DELETE cannot find, with ?");
    },
  },

  // ---- the assembler ----
  {
    id: "ASM-1",
    title: "ADEPT statements: tags, comments, ; and line ends, octal and decimal, !H, REPEAT (ADEPT pp. 3-12)",
    run() {
      const core = new Core();
      const r = assemble(core, "A: 17; B: 17. [ A COMMENT\nC: 3!H+4\n REPEAT 3\n 1\n ENDR\nD: A+2\n", 0o200);
      equal(r.errors.length, 0, "assembled");
      equal(core.read(0o200), 0o17, "octal");
      equal(core.read(0o201), 17, "decimal");
      equal(core.read(0o202), word(3, 4), "!H");
      equal(core.read(0o203) + core.read(0o204) + core.read(0o205), 3, "REPEAT 3");
      equal(core.read(0o206), 0o202, "a tag's value");
    },
  },
  {
    id: "ASM-3",
    title: "A REPEAT count is octal unless it ends in a point; a digit 8 or 9 without one is an error (ADEPT pp. 8, 12)",
    run() {
      const r = assemble(new Core(), "A: REPEAT 8\n 1\n ENDR\n", 0o200);
      equal(r.errors.length, 1, "one error");
      ok(/not octal/.test(r.errors[0].message), "saying why");
      const c = new Core();
      equal(assemble(c, "B: REPEAT 10\n 1\n ENDR\nE: 0\n", 0o200).errors.length, 0, "REPEAT 10 assembles");
      equal(c.addr("E") - c.addr("B"), 8, "10 octal is 8 times");
    },
  },
  {
    id: "ASM-2",
    title: "An undefined symbol is reported with its line (ADEPT p. 14)",
    run() {
      const r = assemble(new Core(), "A: 1\n MDAR NOWHERE\n", 0o200);
      equal(r.errors.length, 1, "one error");
      equal(r.errors[0].line, 2, "on line 2");
      ok(/NOWHERE/.test(r.errors[0].message), "naming the symbol");
    },
  },
  {
    id: "ASM-4",
    title: "Expressions: . is the location, a space between terms adds, !H rotates, a mnemonic is its word, $NAME an external (ADEPT pp. 8-9, 17)",
    run() {
      const core = new Core();
      core.symbols.set("EXT", 0o4321);
      const r = assemble(core, "A: .+2\n 77737!H 77777\n JPSR!H\n MDAR-JUMP-2\n -(60400!H)\n JPSR $EXT\nB = C+1\nC: 0\n", 0o200);
      equal(r.errors.length, 0, "assembled");
      equal(core.read(0o200), 0o202, ". is the location");
      equal(core.read(0o201), 0o7773777777, "two halves, side by side");
      equal(core.read(0o202), 0o20, "JPSR!H: the word rotated");
      equal(core.read(0o203), 0o2073777776, "MDAR-JUMP-2");
      equal(core.read(0o204), 0o1737777777, "a negative is complemented in 30 bits");
      equal(core.read(0o205), assembleOp("JPSR", 0o4321), "an external from the monitor's symbols");
      equal(core.addr("B"), 0o207, "a forward definition makes no word");
      const chained = new Core();
      assemble(chained, " JPSR $X\n JPSR $Y\n JPSR $X\n", 0o100, { externals: "chain" });
      equal(lo(chained.read(0o100)), 0, "chained as a relocatable binary holds them: the first use 0");
      equal(lo(chained.read(0o102)), 0o100, "each later use the address of the one before");
    },
  },
  {
    id: "ASM-5",
    title: "Macros: arguments in parentheses or to the end of the statement, \"...\" quotes, \\ concatenates; ENDM may end a line (ADEPT pp. 10-12, 18)",
    run() {
      const core = new Core();
      const src = [
        "MACRO TEST (AA, BB)",
        " MDXO'F AA",
        " JPLS .+2",
        " JUMP BB",
        "ENDM",
        "MACRO ONE; \"$ONE\" ENDM",
        "MACRO1 TAG (N); N\\1: N\\2: 0; ENDM",
        "GO: TEST(5, GO)",
        " TEST 7, GO",
        " MDAR ONE",
        " TAG X",
      ].join("\n");
      core.symbols.set("ONE", 0o1);
      const r = assemble(core, src, 0o200);
      equal(r.errors.length, 0, "assembled");
      equal(core.read(0o200), assembleOp("MDXO", 5, { F: true }), "an argument in parentheses");
      equal(core.read(0o202), assembleOp("JUMP", 0o200), "and another");
      equal(core.read(0o203), assembleOp("MDXO", 7, { F: true }), "arguments to the end of the statement");
      equal(core.read(0o206), assembleOp("MDAR", 1), "a quoted body: $ONE, not ONE again");
      equal(core.addr("X1"), 0o207, "N\\1 concatenates");
      equal(core.addr("X2"), 0o207, "both tags");
    },
  },
  {
    id: "ASM-6",
    title: "REPEAT, IREPEAT and conditional translation: IFZERO, IFNEGATIVE, IFPASS1, IFSAME, ELSE, ENDC (ADEPT pp. 12-14)",
    run() {
      const core = new Core();
      const src = [
        "IREPEAT X, (1, 2, 3)",
        " X",
        "ENDI",
        "IFZERO 0; 4; ELSE 5; ENDC",
        "IFNEGATIVE 1; 6; ELSE 7; ENDC",
        "IFSAME (A) (A); 10; ENDC",
        "IFSAME (A) (B); 11; ENDC",
        "IFPASS1; TYPEOUT /PASS 1/; ENDC",
        "N = 2",
        "REPEAT N+1; 12; ENDR",
      ].join("\n");
      const r = assemble(core, src, 0o200);
      equal(r.errors.length, 0, "assembled");
      const words = r.listing.flatMap((l) => l.words);
      equal(words.join(" "), [1, 2, 3, 4, 7, 0o10, 0o12, 0o12, 0o12].join(" "), "the words scanned");
      equal(r.typed.join(), "PASS 1", "TYPEOUT in pass 1 only");
    },
  },
  {
    id: "ASM-7",
    title: "Strings: TEXT fills its words, STRING ends with a null, ASCII packs four LCG1 characters a word; a string may run over lines (ADEPT pp. 6-7)",
    run() {
      const core = new Core();
      const r = assemble(core, "A: TEXT /ABCDE/\nB: STRING /ABCDE/\nC: STRING *X\nY*\nD: ASCII *AB@015*\nE: 0\n", 0o200);
      equal(r.errors.length, 0, "assembled");
      equal(core.addr("B") - core.addr("A"), 1, "TEXT: five characters, one word");
      equal(core.addr("C") - core.addr("B"), 2, "STRING: and a null word");
      equal(core.read(core.addr("C")), packText("X\nY")[0], "over a line, the carriage return kept");
      equal(core.read(core.addr("D")), (0o101 * 2 ** 23) + (0o102 * 2 ** 16) + 2 ** 15 + (0o15 * 2 ** 8), "A, B, CR; bit 14 ends the string");
    },
  },
  {
    id: "ASM-8",
    title: "The NCSU sources' instructions: conditional transfers, numbered destinations, 'L, PINT (MH25; research/dpr2-encodings.md)",
    run() {
      const core = new Core();
      const r = assemble(core, " ANAR'O 5\n LSAS 5\n MD10'A 5\n ARMD'L\n 0\n PINT\n", 0);
      equal(r.errors.length, 0, "assembled");
      equal([0, 1, 2, 3, 5].map((a) => hi(core.read(a)).toString(8)).join(" "), "1264 15300 30010 40100 560", "as the tapes show them");
    },
  },

  // ---- the Teletype ----
  {
    id: "TTY-1",
    title: "The Teletype runs at 10 characters a second (SRM5 DPR3 p. 11)",
    run(ctx) {
      const agt = ctx.boot();
      // a character is on the paper once it is struck; the next is struck 0.1 s later. The
      // monitor's date, asked and answered at start, is printed first, at once.
      agt.advance(agt.now);
      const before = agt.paper.getText().length;
      agt.type("HALT!");
      agt.advance(agt.now + 350000);
      equal(agt.paper.getText().slice(before).trim(), "HALT", "four characters struck by 0.35 s");
      agt.advance(agt.now + 100000);
      equal(agt.paper.getText().slice(before).trim(), "HALT!", "five by 0.45 s");
    },
  },
  {
    id: "TTY-2",
    title: "Carriage return and line feed are separate: CR alone overprints (the Teletype)",
    run() {
      const t = new Teletype();
      t.writeText("ABC\rX\r\nD");
      equal(t.getText(), "XBC\nD", "overprinted, then a new line");
    },
  },
  {
    id: "TTY-3",
    title: "The paper is 72 columns wide (the Teletype)",
    run() {
      const t = new Teletype();
      t.writeText("X".repeat(80));
      equal(t.lines[0].length, 72, "the first line");
      equal(t.lines[1].length, 8, "the rest");
    },
  },

  // ---- the programs ----
  {
    id: "PRG-1",
    title: "Every program's statements are taken without a ? and start the display (design/v0.0.1.md, section 2)",
    run(ctx) {
      for (const p of ctx.manifest.programs) {
        const agt = ctx.boot();
        load(ctx, agt, p.id);
        agt.advance(agt.now + 1e6);
        ok(!/^\?/m.test(agt.paper.getText()), `${p.id}: no ?`);
        ok(agt.image !== null, `${p.id}: displaying`);
        near(agt.stats().fps, 40, 1, `${p.id}: at 40 frames a second`);
      }
    },
  },
  {
    id: "PRG-2",
    title: "Fig. 12: 1,000 lines turn at 40 frames a second; 4,000 do not fit, and BUMP raises RATE and types it (FJCC68 p. 752; DSPLY p. 8)",
    run(ctx) {
      const agt = ctx.boot();
      const p = load(ctx, agt, "random-lines");
      agt.advance(agt.now + 1e6);
      equal(agt.frames.at(-1)?.drawn, 1000, "1,000 lines");
      near(agt.stats().fps, 40, 1, "at 40 frames a second");
      const four = p.actions.find((a) => a.id === "lines-4000");
      ok(four, "the card's 4,000 lines");
      typeAndRun(agt, four.type, 1e6);
      equal(agt.frames.at(-1)?.drawn, 4000, "4,000 lines");
      ok(agt.rate > 2, "RATE raised");
      ok(agt.paper.getText().includes(`RATE ${agt.rate}`), "and typed");
      near(agt.stats().fps, framesPerSecond(agt.rate), 1, "refreshing at the new RATE");
      ok(tickUs(agt.rate) >= (agt.frames.at(-1)?.end ?? 0) - (agt.frames.at(-1)?.start ?? 0), "the frame fits");
    },
  },
  {
    id: "PRG-3",
    title: "The tunnel's depth cueing switch turns it off and on, by VIEW (FJCC68 Figs. 15-16)",
    run(ctx) {
      const agt = ctx.boot();
      const p = load(ctx, agt, "tunnel");
      const dimmest = () => Math.min(...lastFrame(agt).filter((g) => g.vis).map((g) => Math.min(g.i0, g.i1)));
      ok(dimmest() < 0.15, "cued: the far end is dim");
      const depth = p.toggles.find((g) => g.id === "depth");
      ok(depth, "a depth cueing switch");
      typeAndRun(agt, depth.off);
      near(dimmest(), 1, 1e-9, "not cued: all at full intensity");
      typeAndRun(agt, depth.on);
      ok(dimmest() < 0.15, "cued again");
    },
  },
  {
    id: "PRG-4",
    title: "The town is one house placed four times (FJCC68 p. 749)",
    run(ctx) {
      const agt = ctx.boot();
      load(ctx, agt, "town");
      const house = lastFrame(agt).filter((g) => g.vis).length;
      equal(house, 4 * 18, "four houses of 18 lines");
    },
  },
  {
    id: "PRG-7",
    title: "Each 3D program's depth cueing range fits its picture, however the dials turn it: nothing is cut off in front of FRONT, and its far side dims (FJCC68 p. 753, Fig. 14)",
    run(ctx) {
      for (const p of ctx.manifest.programs) {
        const depth = p.toggles.find((g) => g.id === "depth");
        if (!depth || p.id === "tunnel") continue; // the tunnel cuts off what the viewer has passed, on purpose
        for (const dials of [[0, 0, 0], [0.25, 0.3, -0.2], [-0.6, 0.45, 0.7], [0.9, -0.5, 0.35]]) {
          const agt = ctx.boot();
          load(ctx, agt, p.id);
          dials.forEach((v, n) => agt.setDial(n, v));
          agt.advance(agt.now + 100000);
          /** the visible strokes' total length, and the dimmest of them */
          const lit = () => {
            const segs = lastFrame(agt).filter((g) => g.vis);
            return { length: segs.reduce((sum, g) => sum + Math.hypot(g.x1 - g.x0, g.y1 - g.y0), 0), dimmest: Math.min(...segs.map((g) => Math.min(g.i0, g.i1))) };
          };
          const off = lit();
          typeAndRun(agt, depth.on);
          const on = lit();
          near(on.length, off.length, off.length * 0.005, `${p.id} at ${dials}: nothing cut off`);
          ok(on.dimmest < 0.3, `${p.id} at ${dials}: the far side dims (${on.dimmest.toFixed(2)})`);
        }
      }
    },
  },
  {
    id: "PRG-6",
    title: "The perspective cube: the processor works out each corner's scale from its depth, 1 / (1 - z/2), and the array turns and scales it, so each corner lands where perspective puts it, in under a frame (FJCC68 eqs. 5-7; DSPLY pp. 22, 33)",
    run(ctx) {
      const agt = ctx.boot();
      load(ctx, agt, "perspective-cube");
      [0.2, -0.3, 0.45].forEach((v, n) => agt.setDial(n, v));
      const t0 = agt.now;
      const c0 = agt.clockUs;
      agt.advance(agt.now + 200000);
      const frames = agt.frames.filter((f) => f.start > t0).length;
      ok(frames > 0, "frames drawn");
      ok((agt.clockUs - c0) / frames < tickUs(agt.rate), "the CLOCK routines fit in a frame");
      // where each corner should land: RXYZ's matrix (Z first, then Y, then X), the eye 2 units
      // away, through the picture scale of V.PCUBE (.99, and the stored scales divided by 1.5)
      const angle = (/** @type {string} */ s) => fromFrac(agt.core.read(agt.core.addr(s)) & 0o77777) * Math.PI;
      const R = rotZYX(angle("DIALZ"), angle("DIALX"), angle("DIALY"));
      const ends = lastFrame(agt).flatMap((g) => [[g.x0, g.y0], [g.x1, g.y1]]);
      for (let v = 0; v < 8; v++) {
        const p = [v & 1 ? 0.35 : -0.35, v & 2 ? 0.35 : -0.35, v & 4 ? 0.35 : -0.35];
        const r = [0, 1, 2].map((i) => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2]);
        const scale = 1 / (1.5 - 0.75 * r[2]);
        near(fromFrac(agt.core.read(agt.core.addr(`S${v}`)) & 0o77777), scale, 3 * LSB, `corner ${v}: its scale`);
        const k = fromFrac(toFrac(0.99)) * scale * 1.5 * 10;
        const want = [(r[0] * k) / 1.5, (r[1] * k) / 1.5];
        const d = Math.min(...ends.map(([x, y]) => Math.hypot(x - want[0], y - want[1])));
        ok(d < 0.02, `corner ${v} on the screen: ${d.toFixed(3)} in from where perspective puts it`);
      }
    },
  },
  {
    id: "PRG-5",
    title: "Tic-tac-toe plays through to a win with the light pen; keys choose the layer (after NCSU)",
    run(ctx) {
      const agt = ctx.boot();
      load(ctx, agt, "tic-tac-toe");
      agt.advance(agt.now + 3e6);
      const o2 = (/** @type {number} */ n) => n.toString(8).padStart(2, "0");
      /** @param {number} k a cell: 9 x layer + 3 x row + column */
      const pick = (k) => {
        const addr = agt.core.addr(`T${o2(k)}`);
        const s = [...agt.segs].reverse().find((g) => g.item === addr && g.vis);
        ok(s, `cell ${k} drawn`);
        agt.pen((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, true);
        agt.advance(agt.now + 60000);
        agt.pen(0, 0, false);
        agt.advance(agt.now + 200000);
      };
      // X takes the bottom layer's first row, then O must go to the middle layer: key 1
      pick(0);
      agt.setKey(1, true);
      agt.advance(agt.now + 100000);
      agt.setKey(1, false);
      agt.advance(agt.now + 100000);
      pick(9);
      agt.setKey(0, true);
      agt.advance(agt.now + 100000);
      agt.setKey(0, false);
      agt.advance(agt.now + 100000);
      for (const k of [1]) pick(k);
      agt.setKey(1, true);
      agt.advance(agt.now + 100000);
      agt.setKey(1, false);
      agt.advance(agt.now + 100000);
      pick(10);
      agt.setKey(0, true);
      agt.advance(agt.now + 100000);
      agt.setKey(0, false);
      agt.advance(agt.now + 100000);
      pick(2);
      agt.advance(agt.now + 3e6);
      ok(agt.paper.getText().includes("X WINS."), "X wins");
      equal(agt.program, null, "the program has ended");
    },
  },
];
