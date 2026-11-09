// SPDX-License-Identifier: Apache-2.0
//
// The page's main loop: it advances the machine by the wall time that passed, times the time
// scale (D2), and asks the views to paint. In slowed time the waits in which the beam draws
// nothing are skipped (at 1/100,000 a 25 ms frame period would take 40 minutes), and statements
// being typed go at the Teletype's own pace, in any time.

/** @typedef {import("../sim/agt.js").Agt30} Agt30 */

/** The most wall time one repaint may advance, ms: a hidden tab does not run away. */
const MAX_WALL_MS = 100;

export class Runner {
  /** @param {() => Agt30} machine the machine now (Reset replaces it) */
  constructor(machine) {
    this.machine = machine;
    /** Simulated time per wall time: 1, 1/1,000 or 1/100,000. */
    this.scale = 1;
    /** @type {((dtUs: number) => void)[]} called after each step, with the simulated time it took */
    this.listeners = [];
    /** @type {number | null} */
    this.last = null;
    this.tick = this.tick.bind(this);
  }

  start() {
    requestAnimationFrame(this.tick);
  }

  /** @param {number} t */
  tick(t) {
    const wall = this.last === null ? 16.7 : Math.min(MAX_WALL_MS, t - this.last);
    this.last = t;
    const agt = this.machine();
    let dt = wall * 1000 * this.scale;
    if (agt.sending.length) dt = Math.max(dt, wall * 1000);
    if (this.scale < 0.01) {
      // skip to the next stroke, or to the next frame's tick, when the beam would only wait
      const segs = agt.segs;
      const under = segs.length && segs[segs.length - 1].t1 > agt.now ? segs.find((s) => s.t1 > agt.now) : undefined;
      if (under && under.t0 > agt.now + 2) dt = Math.max(dt, under.t0 - agt.now);
      else if (!under && agt.image !== null && agt.nextTick > agt.now) dt = Math.max(dt, agt.nextTick - agt.now);
    }
    if (dt > 0) agt.advance(agt.now + dt);
    for (const f of this.listeners) f(dt);
    requestAnimationFrame(this.tick);
  }
}
