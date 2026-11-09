// SPDX-License-Identifier: Apache-2.0
//
// The pictures whose data is generated rather than written by hand, built into core when the
// terminal starts (D6, R15), as if loaded from disk with the rest of the resident programs:
//
// - the stroke font, one sub-image per character (CH and the character's code: CH65 is A),
//   for text the array scales and places (FJCC68 p. 752, Figs. 10-11);
// - RAND, Fig. 12's random lines: up to 4,000 lines, of which NLINES are drawn. RANDN, a
//   resident routine in ADEPT (programs/RAND.adept), moves the RET that ends them;
// - TUNNEL, the items of Figs. 15-16's tunnel, whose coordinates TUNSUB writes every frame
//   for a viewer flying in (R13).
//
// No original image survives; what is ours is listed in R4. The pictures written by hand (the
// letter A, the cube, the viewers) are ADEPT files in programs/.

import { rng } from "./array.js";
import { GLYPHS, strokes } from "./font.js";
import { f, ImageBuilder } from "./image.js";
import { fromFrac, hi, lo, word } from "./words.js";

/** @typedef {import("./terminal.js").Terminal} Terminal */

/** Where the shared variables live. */
export const VARS = 0o3000;
/** Where the generated pictures start. */
export const IMAGES = 0o4000;
/** The most lines Fig. 12's picture holds. */
export const RAND_MAX = 4000;
/** How many it draws at start: "about 1,000" (FJCC68 p. 752). */
export const RAND_START = 1000;

/**
 * The shared variables: the dials' angles that the viewer images turn by (written by DIALS, a
 * CLOCK routine), and Fig. 12's line count (an operator sets it with OPEN).
 */
export const VAR_NAMES = ["DIALZ", "DIALX", "DIALY", "NLINES"];

/** The tunnel: rings of its walls, and the grid lines along them (ours, R4). */
const RINGS = 12;
const TGRID = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1];
/** TUNSUB's time per point: a divide, two multiplies and the stores (R13, est). */
export const TUNSUB_US_PER_POINT = 30;
/** How far dial 0 can fly the viewer in, as a fraction of the tunnel's length. */
const MAX_TRAVEL = 0.95;

/**
 * Writes the generated pictures into a terminal's core and registers TUNSUB.
 * @param {Terminal} term
 * @returns {number} the next free address
 */
export function loadFigures(term) {
  const core = term.core;
  const v = new ImageBuilder(core, VARS);
  for (const name of VAR_NAMES) v.label(name).data(0);
  v.label("TUNSUB").data(0); // TUNSUB's place in core; its code is a JavaScript stand-in (R13)
  v.end();
  core.write(core.addr("NLINES"), RAND_START);

  const b = new ImageBuilder(core, IMAGES);
  /** @param {number} x @param {number} y @param {number} [z] */
  const D = (x, y, z = 0) => b.item("DRAW", [f(z), f(x), f(y)]);
  /** @param {number} x @param {number} y @param {number} [z] */
  const M = (x, y, z = 0) => b.item("MOVE", [f(z), f(x), f(y)]);

  // the stroke font, one sub-image per character, 1/8 of a unit to a grid step
  const unit = 1 / 8;
  for (const ch of Object.keys(GLYPHS)) {
    b.image(`CH${ch.charCodeAt(0)}`);
    for (const s of strokes(ch)) (s.draw ? D : M)(s.x * unit, s.y * unit);
    b.item("RET");
  }

  // Fig. 12: random lines in a chain, each starting where the last ended, inside the unit cube
  const r = rng(12);
  b.image("RAND");
  let px = 0;
  let py = 0;
  let pz = 0;
  M(px, py, pz);
  b.label("RAND.D");
  for (let i = 0; i < RAND_MAX; i++) {
    const len = 0.08 + r() * 0.55;
    const th = r() * Math.PI * 2;
    const ph = Math.acos(r() * 2 - 1);
    px = Math.max(-0.95, Math.min(0.95, px + len * Math.sin(ph) * Math.cos(th)));
    py = Math.max(-0.95, Math.min(0.95, py + len * Math.sin(ph) * Math.sin(th)));
    pz = Math.max(-0.95, Math.min(0.95, pz + len * Math.cos(ph)));
    D(px, py, pz);
  }
  b.item("RET");

  // Figs. 15-16: a rectangular tunnel with gridded walls, seen head-on. The array is linear,
  // so its perspective is computed by TUNSUB, which rewrites every point in core each frame.
  // Each line is one vector, and the vector generator interpolates z along it, so a line into
  // the tunnel dims along its length: that is what makes Fig. 16 read as a tunnel.
  b.image("TUNNEL");
  /** @type {{ at: number; u: number; v: number; d: number; line: boolean }[]} */
  const points = [];
  /**
   * One item of the tunnel: u across, v up, d deep (0 the mouth, 1 the far end); line: the
   * mouth end of a line into the depth (clipped where the viewer is) rather than a ring's corner
   * (gone once the viewer has passed it).
   * @param {"MOVE" | "DRAW"} op @param {number} u @param {number} v @param {number} d @param {boolean} [line]
   */
  const T = (op, u, v, d, line = false) => {
    points.push({ at: b.at, u, v, d, line });
    b.item(op, [0, 0, 0]);
  };
  for (let k = 0; k <= RINGS; k++) {
    const d = k / RINGS;
    T("MOVE", -1, -1, d);
    T("DRAW", 1, -1, d);
    T("DRAW", 1, 1, d);
    T("DRAW", -1, 1, d);
    T("DRAW", -1, -1, d);
  }
  for (const u of TGRID) {
    for (const w of [-1, 1]) {
      T("MOVE", u, w, 0, true);
      T("DRAW", u, w, 1);
      if (Math.abs(u) === 1) continue;
      T("MOVE", w, u, 0, true);
      T("DRAW", w, u, 1);
    }
  }
  b.item("RET");
  const end = b.end();

  // TUNSUB: the viewer has travelled into the tunnel by dial 0's angle as a fraction (0 to
  // 0.95). A point at depth d is now d - travel ahead, and shows at 1 / (1 + 1.25 (d - travel))
  // of the mouth's size. A line into the depth starts where the viewer is; a ring already
  // passed is sent in front of FRONT, where it is blanked. Its z runs from 0.5 at the mouth to
  // -0.5 at the far end; with the tunnel program's VIEW (FRONT .19, BACK -.556 after the
  // standard picture scale) the far end falls at z'm = 0, down 10 : 1 (FJCC68 Fig. 14).
  term.dsply.subroutines.set(core.addr("TUNSUB"), () => {
    const travel = Math.max(0, Math.min(MAX_TRAVEL, fromFrac(lo(core.read(core.addr("DIALZ"))))));
    for (const p of points) {
      const passed = p.d < travel && !p.line;
      const ahead = Math.max(0, p.d - travel);
      const k = 1 / (1 + 1.25 * ahead);
      const z = passed ? 0.95 : 0.5 - ahead;
      core.write(p.at, word(hi(core.read(p.at)), f(z)));
      core.write(p.at + 1, word(f(0.95 * p.u * k), f(0.95 * p.v * k)));
    }
    return points.length * TUNSUB_US_PER_POINT;
  });

  return end;
}
