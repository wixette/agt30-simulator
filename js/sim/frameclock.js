// SPDX-License-Identifier: Apache-2.0
//
// The display clock in the vector generator: it interrupts the processor 120 / (RATE + 1)
// times a second, and each interrupt starts a frame (DSPLY p. 7). RATE 2, 40 frames a second,
// is DSPLY's initial value (p. 9).

/** DSPLY's initial RATE (DSPLY p. 9). */
export const DEFAULT_RATE = 2;
/** The largest RATE we accept; 120 / 120 is one frame a second. */
export const MAX_RATE = 119;

/**
 * Frames a second for a RATE: 120 / (RATE + 1) (DSPLY p. 7).
 * @param {number} rate
 * @returns {number}
 */
export const framesPerSecond = (rate) => 120 / (rate + 1);

/**
 * The microseconds between two ticks at a RATE.
 * @param {number} rate
 * @returns {number}
 */
export const tickUs = (rate) => (1e6 * (rate + 1)) / 120;

/**
 * The smallest RATE whose frame is at least a given length: what BUMP chooses (DSPLY p. 8).
 * @param {number} us the frame's length
 * @param {number} from the RATE to start from
 * @returns {number}
 */
export function rateFor(us, from) {
  let rate = from;
  while (tickUs(rate) < us && rate < MAX_RATE) rate++;
  return rate;
}
