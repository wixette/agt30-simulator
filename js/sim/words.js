// SPDX-License-Identifier: Apache-2.0
//
// 30-bit words, 15-bit half-words and one's-complement numbers, as the AGT keeps them.
//
// Adage numbers bits from the left: bit 0 is the most significant bit of a word and bit 29 the
// least (DSPLY p. 12). A word holds two half-words: the upper half, bits 0-14, and the lower
// half, bits 15-29. Numbers are one's complement: the negative of a value is its bitwise
// complement, so there are two zeros (00000 and 77777 octal in a half-word).
//
// Coordinates, scale factors and angles in an image are 15-bit fractions: "a signed 14-bit one's
// complement binary fraction", from 37777 (full scale) to 40000 (minus full scale), and an angle
// is a fraction of pi (DSPLY pp. 15-16).

/** All ones in a half-word (15 bits). */
export const M15 = 0o77777;
/** All ones in a word (30 bits). */
export const M30 = 0o7777777777;
/** The largest magnitude of a half-word: 37777 octal = 16383. */
export const MAX15 = 0o37777;
/** The weight of one unit of a fraction: a fraction f is stored as round(f * 16384). */
export const ONE15 = 0o40000;

/**
 * The 15-bit one's-complement half-word of an integer.
 * @param {number} n an integer in -16383..16383 (clamped)
 * @returns {number}
 */
export function toOnes15(n) {
  const v = Math.max(-MAX15, Math.min(MAX15, Math.round(n)));
  return v >= 0 ? v : ~-v & M15;
}

/**
 * The integer a 15-bit one's-complement half-word holds. Both zeros give 0.
 * @param {number} h
 * @returns {number}
 */
export function fromOnes15(h) {
  h &= M15;
  return h & ONE15 ? -(~h & M15) || 0 : h;
}

/**
 * The 30-bit one's-complement word of an integer.
 * @param {number} n an integer of magnitude below 2^29 (clamped)
 * @returns {number}
 */
export function toOnes30(n) {
  const max = 0o3777777777;
  const v = Math.max(-max, Math.min(max, Math.round(n)));
  return v >= 0 ? v : M30 - -v;
}

/**
 * The integer a 30-bit one's-complement word holds.
 * @param {number} w
 * @returns {number}
 */
export function fromOnes30(w) {
  w = w % 0x40000000;
  return w >= 0o4000000000 ? -(M30 - w) : w;
}

/**
 * A fraction in (-1, 1) as a half-word (rounded, clamped to full scale).
 * @param {number} f
 * @returns {number}
 */
export const toFrac = (f) => toOnes15(f * ONE15);

/**
 * The fraction a half-word holds.
 * @param {number} h
 * @returns {number}
 */
export const fromFrac = (h) => fromOnes15(h) / ONE15;

/**
 * An angle in radians as a half-word: a fraction of pi, modulo 2 pi.
 * @param {number} rad
 * @returns {number}
 */
export function toAngle(rad) {
  let a = rad / Math.PI;
  a = a - 2 * Math.floor((a + 1) / 2); // into [-1, 1)
  return toFrac(a);
}

/**
 * The angle in radians a half-word holds.
 * @param {number} h
 * @returns {number}
 */
export const fromAngle = (h) => fromFrac(h) * Math.PI;

/** @param {number} w @returns {number} */
export const hi = (w) => Math.floor(w / 0o100000) & M15;
/** @param {number} w @returns {number} */
export const lo = (w) => w & M15;
/**
 * A word from its two half-words.
 * @param {number} upper
 * @param {number} lower
 * @returns {number}
 */
export const word = (upper, lower) => (upper & M15) * 0o100000 + (lower & M15);

/**
 * A word's bits from..to (Adage's numbering, bit 0 on the left), as an unsigned number.
 * @param {number} w
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
export function bits(w, from, to) {
  const width = to - from + 1;
  return Math.floor(w / 2 ** (29 - to)) % 2 ** width;
}

/**
 * Octal, zero-padded.
 * @param {number} n
 * @param {number} [digits]
 * @returns {string}
 */
export const oct = (n, digits = 10) => n.toString(8).padStart(digits, "0");
