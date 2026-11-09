// SPDX-License-Identifier: Apache-2.0
//
// The acceptance checks of the CRT: the phosphor and the eye (R14), and the light pen.

import { assemble } from "../sim/adept.js";
import { USER_AT } from "../sim/agt.js";
import { PEN_TABLE } from "../sim/dsply.js";
import { tickUs } from "../sim/frameclock.js";
import { eyeWindowUs, gainFor, PHOSPHORS, steadyLight } from "../view/phosphor.js";
import { equal, ok } from "./check.js";

/** @typedef {import("./check.js").Check} Check */

/**
 * How much a steady picture's brightness varies from one repaint to the next, as a fraction of
 * its mean, over repaints at every phase of its refresh.
 * @param {number} rate
 * @param {import("../view/phosphor.js").Phosphor} p
 */
function variation(rate, p) {
  const period = tickUs(rate);
  const w = eyeWindowUs(period, 1);
  const v = Array.from({ length: 20 }, (_, k) => steadyLight(period, (k / 20) * period, p.tauUs, w));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return (Math.max(...v) - Math.min(...v)) / mean;
}

/** @type {Check[]} */
export const CRT_CHECKS = [
  {
    id: "CRT-1",
    title: "A picture refreshed 40 times a second looks steady; 20 times a second, it flickers (FJCC68 p. 755; R14)",
    run() {
      for (const p of PHOSPHORS) ok(variation(2, p) < 0.01, `${p.id} at 40 a second: ${variation(2, p)}`);
      ok(variation(5, PHOSPHORS[0]) > 0.3, `the assumed phosphor at 20 a second: ${variation(5, PHOSPHORS[0])}`);
    },
  },
  {
    id: "CRT-2",
    title: "The eye's window is a whole number of frame periods when the picture refreshes often enough (R14)",
    run() {
      for (const rate of [1, 2, 3]) {
        const period = tickUs(rate);
        const n = eyeWindowUs(period, 1) / period;
        ok(Math.abs(n - Math.round(n)) < 1e-9 && n >= 1, `RATE ${rate}: ${n} periods`);
      }
      ok(Math.abs(eyeWindowUs(25000, 1 / 1000) - 1000 / 30) < 1e-9, "slowed 1,000 times, the eye's 33 ms is 33 us");
      ok(gainFor(PHOSPHORS[0]) > 0, "a gain");
    },
  },
  {
    id: "CRT-3",
    title: "The light pen reports the item that drew the line it sees, in the pen-hit table (DSPLY p. 30; R11)",
    run(ctx) {
      const agt = ctx.boot();
      const r = assemble(agt.core, "T: TEXT /T/\n ORMB (2000)\n MOVE (0, -.5, 0)\nL: DRAW (0, .5, 0)\n MOVE (0, -.5, .5)\nM: DRAW (0, .5, .5)\n RET\n", USER_AT);
      equal(r.errors.length, 0, "assembled");
      agt.start(USER_AT);
      agt.advance(agt.now + 100000);
      const target = agt.core.addr("M");
      const s = agt.segs.find((g) => g.item === target && g.vis);
      ok(s, "the line was drawn");
      agt.pen((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, true);
      agt.advance(agt.now + 30000);
      ok((agt.core.read(PEN_TABLE) & 0o77777) > 0, "a hit counted");
      equal(agt.core.read(PEN_TABLE + 1), target, "the item that drew it");
      equal(agt.core.read(PEN_TABLE + 2), USER_AT, "and its image");
    },
  },
];
