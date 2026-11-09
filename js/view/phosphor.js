// SPDX-License-Identifier: Apache-2.0
//
// The phosphor and the eye (R14): how much light a stroke gives off over an interval, and over
// which interval an eye sums it. Pure arithmetic, shared by the CRT view and the tests.
//
// A browser repaints about 60 times a second, the AGT refreshed its picture 20 to 60 times a
// second, and the phosphor fades in a millisecond or so. Drawing "what is lit at this instant"
// would beat against the monitor. So each repaint shows what an eye sees: the light each stroke
// gave off over the last W microseconds,
//
//     (tau / W) * (exp(-a / tau) - exp(-b / tau))
//
// for a stroke drawn a and b microseconds before the interval's start and end. An eye sums
// light over about 33 ms. In real time W is a whole number of frame periods when the picture
// refreshes at least that often, so a steady picture looks steady whatever the phase of the
// repaint; a picture refreshed more slowly (20 a second) is caught between frames by some
// repaints, and flickers, as it did. In slowed time W is the eye's 33 ms, slowed: the face then
// shows the beam drawing, its trail fading with the phosphor.

/**
 * @typedef {object} Phosphor
 * @property {"p31" | "p4" | "p7"} id the ?phosphor= value (docs/development.md)
 * @property {number} tauUs decay time constant (simulated microseconds)
 * @property {string} color the token of its colour
 */

/** The GDS1's phosphor is not documented: P31-like is ours (R14); P4 and P7 for comparison. */
export const PHOSPHORS = /** @type {Phosphor[]} */ ([
  { id: "p31", tauUs: 1500, color: "--phosphor" },
  { id: "p4", tauUs: 300, color: "--phosphor-p4" },
  { id: "p7", tauUs: 60000, color: "--phosphor-p7" },
]);

/** How long an eye sums light, us: a thirtieth of a second. */
export const EYE_US = 1e6 / 30;

/**
 * The phosphor for a ?phosphor= value; P31-like unless another is named.
 * @param {string | null | undefined} id
 * @returns {Phosphor}
 */
export const phosphorById = (id) => PHOSPHORS.find((p) => p.id === id) ?? PHOSPHORS[0];

/**
 * The interval an eye sums light over, in simulated microseconds.
 * @param {number} periodUs the picture's frame period
 * @param {number} scale simulated time per real time (1 in real time)
 * @returns {number}
 */
export function eyeWindowUs(periodUs, scale) {
  if (scale < 1) return EYE_US * scale;
  if (periodUs > EYE_US) return EYE_US;
  return Math.max(1, Math.round(EYE_US / periodUs)) * periodUs;
}

/**
 * The mean light of a stroke over an interval, relative to the light it gave when fresh.
 * @param {number} ageStart its age at the interval's start (0 if drawn during it), us
 * @param {number} ageEnd its age at the interval's end, us
 * @param {number} tau the phosphor's decay, us
 * @param {number} window the interval's length, us
 * @returns {number}
 */
export function light(ageStart, ageEnd, tau, window) {
  return (tau / window) * (Math.exp(-ageStart / tau) - Math.exp(-ageEnd / tau));
}

/**
 * The mean light of a stroke refreshed every period, seen over an eye window ending at a time:
 * what a point of a steady picture looks like.
 * @param {number} periodUs
 * @param {number} phaseUs when the window ends, after a refresh
 * @param {number} tau
 * @param {number} window
 * @returns {number}
 */
export function steadyLight(periodUs, phaseUs, tau, window) {
  let sum = 0;
  for (let t = phaseUs; t < window + 8 * tau + periodUs; t += periodUs) {
    // a refresh t us before the window's end
    sum += light(Math.max(0, t - window), t, tau, window);
  }
  return sum;
}

/**
 * The gain that makes a steady 40-frames-a-second picture shine at full brightness, a little
 * over, so that it saturates rather than shimmers.
 * @param {Phosphor} p
 * @returns {number}
 */
export function gainFor(p) {
  const period = 25000;
  return 1.5 / steadyLight(period, 0, p.tauUs, eyeWindowUs(period, 1));
}
