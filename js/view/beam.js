// SPDX-License-Identifier: Apache-2.0
//
// Where the beam is at an instant, and what the three signals that steer it are doing: X and Y
// (the deflection, inches from the centre) and Z (the beam on, and how bright, or blanked).
// For the Tube viewpoint: its beam and its traces (R20).

/** @typedef {import("../sim/dsply.js").Seg} Seg */

/**
 * @typedef {object} BeamState
 * @property {number} x inches from the centre
 * @property {number} y
 * @property {number} z the beam's brightness, 0..1; 0 when blanked
 * @property {boolean} drawing a stroke is being drawn now (not a move, not waiting)
 * @property {Seg | null} seg the stroke under way, if any
 */

/**
 * The beam at a time: on a stroke, moving with the beam blanked, or resting where the last stroke
 * left it, blanked, until the next frame.
 * @param {Seg[]} segs oldest first, absolute times
 * @param {number} now us
 * @returns {BeamState}
 */
export function beamAt(segs, now) {
  // the last stroke that started by now
  let lo = 0;
  let hi = segs.length - 1;
  let k = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (segs[m].t0 <= now) {
      k = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  if (k < 0) return { x: 0, y: 0, z: 0, drawing: false, seg: null };
  const s = segs[k];
  if (now >= s.t1) return { x: s.x1, y: s.y1, z: 0, drawing: false, seg: null };
  const f = s.t1 > s.t0 ? (now - s.t0) / (s.t1 - s.t0) : 1;
  return { x: s.x0 + (s.x1 - s.x0) * f, y: s.y0 + (s.y1 - s.y0) * f, z: s.vis ? s.i0 + (s.i1 - s.i0) * f : 0, drawing: s.vis, seg: s };
}

/**
 * What the beam is doing now, in words a reader can be told: drawing a line; blanked for a move;
 * blanked, waiting for the next frame; or off, with nothing displayed.
 * @param {import("../sim/terminal.js").Terminal} term
 * @returns {"drawing" | "moving" | "waiting" | "off"}
 */
export function beamState(term) {
  if (term.image === null) return "off";
  const b = beamAt(term.segs, term.now);
  if (b.drawing) return "drawing";
  return b.seg ? "moving" : "waiting";
}
