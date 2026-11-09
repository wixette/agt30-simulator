// SPDX-License-Identifier: Apache-2.0
//
// The GDS1 scope's face: the beam's strokes, each with the time it was drawn, on a phosphor that
// glows and fades (R14; the arithmetic is in phosphor.js). The same view paints the full-
// resolution Screen viewpoint and the 3D scope face's texture, and finds where the light pen
// points.

import { gainFor, light, PHOSPHORS } from "./phosphor.js";
import { rgbOf, token } from "./theme.js";

/** @typedef {import("../sim/dsply.js").Seg} Seg */
/** @typedef {import("./phosphor.js").Phosphor} Phosphor */

/** Inches of the visible face (12 in square). */
const FACE_IN = 12;

export class CrtView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ size?: number }} [opts] size: a fixed size in pixels (for a canvas not on the page,
   *   such as the 3D view's scope face); otherwise the canvas follows its size on screen
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    /** @type {number | undefined} */
    this.size = opts.size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2D canvas");
    this.ctx = ctx;
    /** @type {Phosphor} */
    this.phosphor = PHOSPHORS[0];
    /** Brightness of a fresh stroke relative to a steady 40 frames-a-second picture. */
    this.gain = 1;
    /** The phosphor's colour. */
    this.color = "#7dff9b";
    this.setPhosphor(PHOSPHORS[0]);
  }

  /** @param {Phosphor} p */
  setPhosphor(p) {
    this.phosphor = p;
    this.gain = gainFor(p);
    this.color = token(p.color, "#7dff9b");
  }

  /** Matches the canvas's pixels to its size on screen. */
  fit() {
    if (this.size) {
      if (this.canvas.width !== this.size) this.canvas.width = this.canvas.height = this.size;
      return;
    }
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.max(64, Math.round(r.width * dpr));
    if (this.canvas.width !== w || this.canvas.height !== w) {
      this.canvas.width = w;
      this.canvas.height = w;
    }
  }

  /**
   * Paints the face as an eye sees it over the interval (now - window, now].
   * @param {Seg[]} segs strokes with absolute times, oldest first
   * @param {number} now simulated microseconds
   * @param {number} windowUs the eye's window, simulated microseconds (eyeWindowUs)
   * @param {{ beam?: boolean }} [opts] beam: show the spot where the beam is now (slow motion)
   */
  paint(segs, now, windowUs, opts = {}) {
    this.fit();
    const { ctx, canvas } = this;
    const S = canvas.width;
    const k = S / FACE_IN;
    const tau = this.phosphor.tauUs;
    const W = Math.max(windowUs, 1e-3);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = token("--crt-face", "#050806");
    ctx.fillRect(0, 0, S, S);
    const LEVELS = 24;
    /** @type {Path2D[]} */
    const paths = Array.from({ length: LEVELS }, () => new Path2D());
    const counts = new Array(LEVELS).fill(0);
    const oldest = now - 6 * tau - W;
    const X = (/** @type {number} */ x) => S / 2 + x * k;
    const Y = (/** @type {number} */ y) => S / 2 - y * k;
    /** @type {[number, number] | null} */
    let beamAt = null;
    /** Lines whose brightness changes along them (depth cueing): drawn one by one, each with a
     * gradient, so there are no joints to light up. @type {[number, number, number, number, number, number][]} */
    const graded = [];
    // walk back from the newest stroke
    for (let n = segs.length - 1; n >= 0; n--) {
      const s = segs[n];
      if (s.t1 < oldest) break;
      if (s.t0 > now) continue;
      const part = s.t1 > now ? (now - s.t0) / (s.t1 - s.t0) : 1;
      if (s.t1 > now) beamAt = [s.x0 + (s.x1 - s.x0) * part, s.y0 + (s.y1 - s.y0) * part];
      if (!s.vis) continue;
      const t = s.t0 + (Math.min(now, s.t1) - s.t0) / 2;
      const ageEnd = now - t;
      const ageStart = Math.max(0, ageEnd - W);
      const lit = light(ageStart, ageEnd, tau, W);
      const pieces = Math.max(1, Math.min(8, Math.ceil(Math.abs(s.i1 - s.i0) * 12)));
      if (pieces > 1 && graded.length < 1500) {
        const a0 = Math.min(1, lit * this.gain * s.i0);
        const a1 = Math.min(1, lit * this.gain * (s.i0 + (s.i1 - s.i0) * part));
        if (Math.max(a0, a1) >= 0.004) graded.push([X(s.x0), Y(s.y0), X(s.x0 + (s.x1 - s.x0) * part), Y(s.y0 + (s.y1 - s.y0) * part), a0, a1]);
        continue;
      }
      for (let p = 0; p < pieces; p++) {
        const u0 = (p / pieces) * part;
        const u1 = ((p + 1) / pieces) * part;
        const i = s.i0 + ((s.i1 - s.i0) * (u0 + u1)) / 2;
        const a = Math.min(1, lit * this.gain * i);
        if (a < 0.004) continue;
        const lvl = Math.min(LEVELS - 1, Math.floor(Math.sqrt(a) * LEVELS));
        const path = paths[lvl];
        path.moveTo(X(s.x0 + (s.x1 - s.x0) * u0), Y(s.y0 + (s.y1 - s.y0) * u0));
        const x1 = s.x0 + (s.x1 - s.x0) * u1;
        const y1 = s.y0 + (s.y1 - s.y0) * u1;
        // a zero-length stroke still lights a dot
        path.lineTo(X(x1) + (u1 === u0 || (x1 === s.x0 && y1 === s.y0) ? 0.01 : 0), Y(y1));
        counts[lvl]++;
      }
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const spot = Math.max(1.1, 0.02 * k);
    for (let lvl = 0; lvl < LEVELS; lvl++) {
      if (!counts[lvl]) continue;
      const a = ((lvl + 0.5) / LEVELS) ** 2;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = a * 0.22;
      ctx.lineWidth = spot * 3.2;
      ctx.stroke(paths[lvl]);
      // the core with flat ends: a line dimming with depth is drawn in pieces, and round ends
      // would overlap at each joint and light a row of dots
      ctx.globalAlpha = a;
      ctx.lineWidth = spot;
      ctx.lineCap = "butt";
      ctx.stroke(paths[lvl]);
      ctx.lineCap = "round";
    }
    const rgb = rgbOf(this.color).join(",");
    for (const [x0, y0, x1, y1, a0, a1] of graded) {
      if (x0 === x1 && y0 === y1) continue;
      for (const [k, w] of [[0.22, spot * 3.2], [1, spot]]) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, `rgba(${rgb},${a0 * k})`);
        g.addColorStop(1, `rgba(${rgb},${a1 * k})`);
        ctx.strokeStyle = g;
        ctx.globalAlpha = 1;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    if (opts.beam && beamAt) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = token("--phosphor-core", "#e8ffe9");
      ctx.beginPath();
      ctx.arc(X(beamAt[0]), Y(beamAt[1]), Math.max(2, spot * 1.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  /**
   * Inches on the face for a point on the canvas (for the light pen).
   * @param {number} clientX
   * @param {number} clientY
   * @returns {[number, number]}
   */
  toInches(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return [((clientX - r.left) / r.width - 0.5) * FACE_IN, (0.5 - (clientY - r.top) / r.height) * FACE_IN];
  }
}
