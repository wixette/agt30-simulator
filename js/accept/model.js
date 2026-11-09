// SPDX-License-Identifier: Apache-2.0
//
// The acceptance checks of the model: words, the image format, the array, the vector
// generator, DSPLY, the processor, the monitor, the assembler, the Teletype and the programs
// (design/v0.0.1.md, section 4). Each check's expected values come from the documents, or from
// a decision when the value is ours, and say which.

import { assemble } from "../sim/adept.js";
import { USER_AT } from "../sim/agt.js";
import { HybridArray } from "../sim/array.js";
import { assembleOp, onesAdd, TIME } from "../sim/dpr2.js";
import { MAX_DEPTH, rotZYX } from "../sim/dsply.js";
import { framesPerSecond, tickUs } from "../sim/frameclock.js";
import { AM, BY_NAME, COND, CONDITION, Core, decode, DT, WINDOW } from "../sim/image.js";
import { Teletype } from "../sim/teletype.js";
import { vectorTime } from "../sim/vecgen.js";
import { bits, fromAngle, fromFrac, fromOnes15, oct, toFrac, toOnes15, word } from "../sim/words.js";
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
        `T:  TEXT /T/
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
    title: "x' = PS [D + SC (R x)] for every row, exact on the quantised numbers (FJCC68 eqs. 5-7; D8)",
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
      show(agt, "T: TEXT /T/\n ROTZ (90DEG)\n DRAW (0, .5, 0)\n RET\n");
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
      show(agt, "T: TEXT /T/\n MOVE (0, -.5, 0)\n DRAW (0, .5, 0)\n RET\n", "VIEW (37777, 40000, 37777)!");
      const mid = lastFrame(agt).find((g) => g.vis);
      ok(mid, "a stroke at z' = 0");
      near(mid.i0, 0.1, 0.002, "intensity at z'm = 0");
      const front = ctx.boot();
      show(front, "T: TEXT /T/\n MOVE (.9, -.5, 0)\n DRAW (.9, .5, 0)\n RET\n", "VIEW (.1, 40000, 37777)!");
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
        for (let k = 0; k < depth; k++) src += `S${k}: TEXT /S${k}/\n IMG (S${k + 1})\n RET\n`;
        src += `S${depth}: TEXT /END/\n MOVE (0, 0, 0)\n DRAW (0, .1, .1)\n RET\n`;
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
      show(agt, "T: TEXT /T/\n SAVT\n DX (.5)\n REST\n DRAW (0, 0, .5)\n RET\n");
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
    title: "JPSR stores the return at A and continues at A+1; a routine takes its arguments after the call (SRM5 DPR3 p. 6; AMRMX p. 3)",
    run(ctx) {
      const agt = ctx.boot();
      const r = assemble(agt.core, "S: 0\n MDAR'I'X S\n MDAE'I'X S\n JUMP'I S\nGO: JPSR S; 7; 5\n JUMP GO\n", USER_AT);
      equal(r.errors.length, 0, "assembled");
      // S adds the two words after the call: it reads them through its return address, stepping it
      const go = agt.core.addr("GO");
      agt.core.write(go + 3, assembleOp("JUMP", go + 3));
      const run = agt.cpu.run(go, go + 3, 1000);
      ok(run.done, "returned past its arguments");
      equal(agt.cpu.AR, 7 + 5, "the sum of its two arguments");
    },
  },
  {
    id: "CPU-3",
    title: "RVCD reads a dial through the array's comparator to 2 LSB, in under 1 ms (SRM5 GHA4; R7)",
    run(ctx) {
      const agt = ctx.boot();
      for (const v of [0.3, -0.71, 0.0005, 0.999]) {
        agt.setDial(2, v);
        const r = agt.cpu.call(agt.core.addr("RVCD"), [2], USER_AT, 10000);
        ok(r.done, "returned");
        near(fromFrac(agt.cpu.AR & 0o77777), v, 2 * LSB, `dial at ${v}`);
        ok(r.us < 1000, `in ${r.us} us`);
      }
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

  // ---- the Teletype ----
  {
    id: "TTY-1",
    title: "The ASR-33 runs at 10 characters a second (SRM5 DPR3 p. 11)",
    run(ctx) {
      const agt = ctx.boot();
      // a character is on the paper once it is struck; the next is struck 0.1 s later
      agt.type("HALT!");
      agt.advance(agt.now + 350000);
      equal(agt.paper.getText().trim(), "HALT", "four characters struck by 0.35 s");
      agt.advance(agt.now + 100000);
      equal(agt.paper.getText().trim(), "HALT!", "five by 0.45 s");
    },
  },
  {
    id: "TTY-2",
    title: "Carriage return and line feed are separate: CR alone overprints (the ASR-33)",
    run() {
      const t = new Teletype();
      t.writeText("ABC\rX\r\nD");
      equal(t.getText(), "XBC\nD", "overprinted, then a new line");
    },
  },
  {
    id: "TTY-3",
    title: "The paper is 72 columns wide (the ASR-33)",
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
    title: "The perspective cube: the processor turns each corner as RXYZ does and divides it by its distance from the eye, within 2 LSB, in under a frame (FJCC68 eqs. 5-7; DSPLY p. 22)",
    run(ctx) {
      const agt = ctx.boot();
      load(ctx, agt, "perspective-cube");
      const dials = [0.2, -0.3, 0.45];
      dials.forEach((v, n) => agt.setDial(n, v));
      const t0 = agt.now;
      const c0 = agt.clockUs;
      agt.advance(agt.now + 200000);
      const frames = agt.frames.filter((f) => f.start > t0).length;
      ok(frames > 0, "frames drawn");
      ok((agt.clockUs - c0) / frames < tickUs(agt.rate), "the CLOCK routines fit in a frame");
      // the corners as they should land: RXYZ's matrix (Z first, then Y, then X), the eye 2 units away
      const angle = (/** @type {string} */ s) => fromFrac(agt.core.read(agt.core.addr(s)) & 0o77777) * Math.PI;
      const [az, ax, ay] = [angle("DIALZ"), angle("DIALX"), angle("DIALY")];
      const R = rotZYX(az, ax, ay);
      for (let v = 0; v < 8; v++) {
        const p = [v & 1 ? 0.35 : -0.35, v & 2 ? 0.35 : -0.35, v & 4 ? 0.35 : -0.35];
        const r = [0, 1, 2].map((i) => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2]);
        const k = 1 / (1 - r[2] / 2);
        const got = (/** @type {string} */ s) => fromFrac(agt.core.read(agt.core.addr(s) + v) & 0o77777);
        near(got("PX"), r[0] * k, 4 * LSB, `corner ${v}: x`);
        near(got("PY"), r[1] * k, 4 * LSB, `corner ${v}: y`);
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
