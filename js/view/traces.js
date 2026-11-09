// SPDX-License-Identifier: Apache-2.0
//
// The three signals that steer the beam, against time, for the frame being drawn (the Tube
// viewpoint, R20): X and Y, the deflection the vector generator ramps from one end point to the
// next, and Z, the beam on (how bright) or blanked for a move. The whole frame is drawn faintly,
// what has been drawn so far brightly, with a cursor at now: in slowed time the cursor walks
// along as the beam draws on the scope. Its words come from the page (U11).

import { token } from "./theme.js";
import { beamAt } from "./beam.js";
import { framesPerSecond } from "../sim/frameclock.js";

/** @typedef {import("../sim/terminal.js").Terminal} Terminal */

/**
 * The words the view writes, from the page's messages.
 * @typedef {object} TraceLabels
 * @property {string} x
 * @property {string} y
 * @property {string} z
 * @property {string} empty nothing on the display
 * @property {(state: "waiting" | "preparing" | "drawing" | "moving", us: number, total: number, fps: number, rate: number) => string} status
 */

export class TracesView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {TraceLabels} labels
   */
  constructor(canvas, labels) {
    this.canvas = canvas;
    this.labels = labels;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2D canvas");
    this.ctx = ctx;
  }

  /** @param {Terminal} term */
  paint(term) {
    const { canvas, ctx } = this;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const W = Math.max(200, Math.round(r.width * dpr));
    const H = Math.max(120, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const ink = token("--md-on-surface-variant", "#c1c7d0");
    const lanes = [
      { key: "x", name: this.labels.x, color: token("--trace-x", "#9ecaff"), lo: -6, hi: 6 },
      { key: "y", name: this.labels.y, color: token("--trace-y", "#ffb86b"), lo: -6, hi: 6 },
      { key: "z", name: this.labels.z, color: token("--phosphor", "#7dff9b"), lo: 0, hi: 1 },
    ];
    ctx.clearRect(0, 0, W, H);
    ctx.font = `${11 * dpr}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = "top";
    // the frame on the screen now: the last one that started
    const f = [...term.frames].reverse().find((q) => q.start <= term.now);
    const left = 8 * dpr;
    const right = W - 8 * dpr;
    const top = 4 * dpr;
    const axis = 16 * dpr;
    const laneH = (H - top - axis) / 3;
    if (!f || f.end <= f.start) {
      ctx.fillStyle = ink;
      ctx.fillText(this.labels.empty, left, top);
      return;
    }
    // from the frame's first stroke to its end (before it, the processor prepares the frame)
    const segs = term.segs.filter((s) => s.t1 > f.start && s.t0 < f.end);
    const t0 = segs.length ? segs[0].t0 : f.start;
    const t1 = Math.max(f.end, t0 + 1);
    const X = (/** @type {number} */ t) => left + ((t - t0) / (t1 - t0)) * (right - left);
    // X and Y share one scale, fitted to the picture's own extent (a letter is small on the face)
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of segs) for (const v of [s.x0, s.x1, s.y0, s.y1]) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
    if (hi > lo) {
      const half = Math.max((hi - lo) / 2, 0.01) * 1.1;
      for (const lane of lanes.slice(0, 2)) {
        const mid = lane.key === "x" ? middle(segs, "x") : middle(segs, "y");
        lane.lo = mid - half;
        lane.hi = mid + half;
      }
    }
    lanes.forEach((lane, li) => {
      const y0 = top + li * laneH;
      const Y = (/** @type {number} */ v) => y0 + laneH - 4 * dpr - ((v - lane.lo) / (lane.hi - lane.lo)) * (laneH - 18 * dpr);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const base = Math.min(lane.hi, Math.max(lane.lo, 0));
      ctx.moveTo(left, Y(base));
      ctx.lineTo(right, Y(base));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = lane.color;
      ctx.fillText(lane.name, left, y0);
      // the signal: a ramp along each stroke, held between strokes; Z steps
      for (const pass of [0, 1]) {
        ctx.strokeStyle = lane.color;
        ctx.lineWidth = (pass ? 1.6 : 1.2) * dpr;
        ctx.globalAlpha = pass ? 1 : 0.28;
        ctx.beginPath();
        let started = false;
        for (const s of segs) {
          const a = Math.max(s.t0, t0);
          let b = Math.min(s.t1, t1);
          if (pass) b = Math.min(b, term.now);
          if (b < a) break;
          const at = (/** @type {number} */ t) => {
            const q = s.t1 > s.t0 ? (t - s.t0) / (s.t1 - s.t0) : 1;
            if (lane.key === "x") return s.x0 + (s.x1 - s.x0) * q;
            if (lane.key === "y") return s.y0 + (s.y1 - s.y0) * q;
            return s.vis ? s.i0 + (s.i1 - s.i0) * q : 0;
          };
          if (!started) ctx.moveTo(X(a), Y(at(a)));
          else ctx.lineTo(X(a), Y(at(a)));
          ctx.lineTo(X(b), Y(at(b)));
          started = true;
        }
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    // the cursor at now, and the time axis
    if (term.now >= t0 && term.now <= t1) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(term.now), top);
      ctx.lineTo(X(term.now), H - axis);
      ctx.stroke();
    }
    const b = beamAt(term.segs, term.now);
    ctx.fillStyle = ink;
    const us = Math.max(0, Math.min(term.now, t1) - t0);
    const state = term.now > t1 ? "waiting" : term.now < t0 ? "preparing" : b.drawing ? "drawing" : "moving";
    ctx.fillText(this.labels.status(state, us, t1 - t0, framesPerSecond(term.rate), term.rate), left, H - axis + 3 * dpr);
  }
}

/**
 * The middle of the strokes' range along one axis.
 * @param {import("../sim/dsply.js").Seg[]} segs
 * @param {"x" | "y"} k
 * @returns {number}
 */
function middle(segs, k) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of segs) for (const v of k === "x" ? [s.x0, s.x1] : [s.y0, s.y1]) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
  return (lo + hi) / 2;
}
