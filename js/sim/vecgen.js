// SPDX-License-Identifier: Apache-2.0
//
// The AVG1 vector generator and the GDS1 scope's geometry (SRM5 AVG1 pp. 1-3, GDS1).
//
// The vector generator draws a straight line from where the beam is to the end point the array
// gives it, at nearly constant spot speed, so its time grows with the vector's longest component.
// The manual gives the time only as a range (5-39 us, 3 us of it between vectors) and as counts
// of vectors that fit in a 40 frames-a-second frame (25,000 us). Those counts fix the curve:
//
//     4,550 short (< 0.5 in) vectors   -> 5.5 us each   (set by the processor's 5.5 us a table
//                                                        vector, SRM5 p. 2; the beam's own
//                                                        minimum is 5 us)
//     2,940 vectors with 1-in components -> 8.5 us
//     1,660 with 3-in                  -> 15.1 us       (2D and 3D alike)
//       800 with 7-in                  -> 31.3 us
//       640 with 10-in                 -> 39.1 us
//
// A move (invisible) of 0.5-3 in takes as long as a draw; a longer move takes 15 us.

/** Inches per full-scale output (DSPLY p. 22: full scale spans a 20-inch square). */
export const INCH_PER_FS = 10;
/** The visible square is 12 x 12 in; the drive is clamped at its edge (AVG1 p. 1). */
export const CLAMP_IN = 6;
/** The quality area, 10 x 10 in (GDS1). */
export const QUALITY_IN = 5;
/** The longest component one stroke can draw (AVG1 p. 1). */
export const MAX_COMPONENT_IN = 10;

/** [component length in inches, time in microseconds], from the counts above. */
export const DRAW_CURVE = /** @type {const} */ ([
  [0.5, 5.0],
  [1, 25000 / 2940],
  [3, 25000 / 1660],
  [7, 25000 / 800],
  [10, 25000 / 640],
]);

/** A short-vector table (2DTF) draws one vector every 5 us (DSPLY p. 18). */
export const SHORT_US = 5;
/** A long move (a component over 3 in) takes 15 us (AVG1 p. 1). */
export const LONG_MOVE_US = 15;

/**
 * The time to draw (or move) a vector whose longest component is `len` inches.
 * @param {number} len
 * @param {boolean} visible
 * @returns {number} microseconds, the gap to the next vector included
 */
export function vectorTime(len, visible) {
  if (!visible && len > 3) return LONG_MOVE_US;
  if (len <= DRAW_CURVE[0][0]) return DRAW_CURVE[0][1];
  for (let i = 1; i < DRAW_CURVE.length; i++) {
    const [l0, t0] = DRAW_CURVE[i - 1];
    const [l1, t1] = DRAW_CURVE[i];
    if (len <= l1) return t0 + ((t1 - t0) * (len - l0)) / (l1 - l0);
  }
  return DRAW_CURVE[DRAW_CURVE.length - 1][1];
}

/**
 * Where a short-mode stroke really ends, and how bright it is: "longer vector lengths result in
 * poor end matching and low intensities. At lengths of two inches and greater, gross errors and
 * distortions result" (DSPLY p. 18). The beam has only 5 us, so it falls short; the curve is
 * our estimate.
 * @param {number} len inches
 * @returns {{ reach: number; bright: number }} fraction of the way it gets, and its intensity
 */
export function shortStroke(len) {
  if (len <= 0.5) return { reach: 1, bright: 1 };
  return { reach: Math.max(0.35, 1 - 0.22 * (len - 0.5)), bright: Math.max(0.15, 0.5 / len) };
}

/**
 * Intensity against depth (FJCC68 p. 753, Fig. 14; DSPLY p. 9). z'm is depth mapped so that FRONT is
 * +1 and BACK -1. The intensity falls exponentially into the screen, 10:1 down at z'm = 0 when
 * DIM is full scale; in front of FRONT the beam is blanked.
 * @param {number} zm
 * @param {number} dim 0..1 (DIM / 37777)
 * @returns {number} 0..1, or 0 when blanked
 */
export function depthIntensity(zm, dim) {
  if (zm > 1) return 0;
  return Math.pow(10, dim * (zm - 1));
}

/**
 * Maps z' (fraction) to z'm for the VIEW parameters.
 * @param {number} z
 * @param {number} front fraction
 * @param {number} back fraction
 * @returns {number}
 */
export function zm(z, front, back) {
  const span = front - back;
  if (Math.abs(span) < 1e-9) return 1;
  return (2 * (z - back)) / span - 1;
}
