// SPDX-License-Identifier: Apache-2.0
//
// A stroke font for programmatically generated text, as in the 1968 paper's Figures 10 and 11:
// "alphanumeric text which was generated programmatically (without the use of a character
// generator). Scaling and translation operations are performed by the array to place characters
// of appropriate size at appropriate locations on the screen" (FJCC68 p. 752).
//
// Adage's own font is not documented. These glyphs are ours (R4), drawn on a 4 x 6 grid with
// the strokes a vector display would use. Each glyph is a path: "M x y"
// moves, "L x y" draws.

/** @type {Record<string, string>} */
export const GLYPHS = {
  A: "M0 0 L0 4 L2 6 L4 4 L4 0 M0 3 L4 3",
  B: "M0 0 L0 6 L3 6 L4 5 L4 4 L3 3 L0 3 M3 3 L4 2 L4 1 L3 0 L0 0",
  C: "M4 1 L3 0 L1 0 L0 1 L0 5 L1 6 L3 6 L4 5",
  D: "M0 0 L0 6 L3 6 L4 5 L4 1 L3 0 L0 0",
  E: "M4 0 L0 0 L0 6 L4 6 M0 3 L3 3",
  F: "M0 0 L0 6 L4 6 M0 3 L3 3",
  G: "M4 5 L3 6 L1 6 L0 5 L0 1 L1 0 L3 0 L4 1 L4 3 L2 3",
  H: "M0 0 L0 6 M4 0 L4 6 M0 3 L4 3",
  I: "M1 0 L3 0 M2 0 L2 6 M1 6 L3 6",
  J: "M0 1 L1 0 L3 0 L4 1 L4 6",
  K: "M0 0 L0 6 M4 6 L0 2 M1 3 L4 0",
  L: "M0 6 L0 0 L4 0",
  M: "M0 0 L0 6 L2 3 L4 6 L4 0",
  N: "M0 0 L0 6 L4 0 L4 6",
  O: "M1 0 L0 1 L0 5 L1 6 L3 6 L4 5 L4 1 L3 0 L1 0",
  P: "M0 0 L0 6 L3 6 L4 5 L4 4 L3 3 L0 3",
  Q: "M1 0 L0 1 L0 5 L1 6 L3 6 L4 5 L4 1 L3 0 L1 0 M2 2 L4 0",
  R: "M0 0 L0 6 L3 6 L4 5 L4 4 L3 3 L0 3 M2 3 L4 0",
  S: "M0 1 L1 0 L3 0 L4 1 L4 2 L3 3 L1 3 L0 4 L0 5 L1 6 L3 6 L4 5",
  T: "M0 6 L4 6 M2 6 L2 0",
  U: "M0 6 L0 1 L1 0 L3 0 L4 1 L4 6",
  V: "M0 6 L2 0 L4 6",
  W: "M0 6 L1 0 L2 3 L3 0 L4 6",
  X: "M0 0 L4 6 M0 6 L4 0",
  Y: "M0 6 L2 3 L4 6 M2 3 L2 0",
  Z: "M0 6 L4 6 L0 0 L4 0",
  0: "M1 0 L0 1 L0 5 L1 6 L3 6 L4 5 L4 1 L3 0 L1 0 M0 1 L4 5",
  1: "M1 5 L2 6 L2 0 M1 0 L3 0",
  2: "M0 5 L1 6 L3 6 L4 5 L4 4 L0 0 L4 0",
  3: "M0 5 L1 6 L3 6 L4 5 L4 4 L3 3 L4 2 L4 1 L3 0 L1 0 L0 1 M1 3 L3 3",
  4: "M3 0 L3 6 L0 2 L4 2",
  5: "M4 6 L0 6 L0 3 L3 3 L4 2 L4 1 L3 0 L0 0",
  6: "M4 5 L3 6 L1 6 L0 5 L0 1 L1 0 L3 0 L4 1 L4 2 L3 3 L0 3",
  7: "M0 6 L4 6 L1 0",
  8: "M1 3 L0 4 L0 5 L1 6 L3 6 L4 5 L4 4 L3 3 L1 3 L0 2 L0 1 L1 0 L3 0 L4 1 L4 2 L3 3",
  9: "M0 1 L1 0 L3 0 L4 1 L4 5 L3 6 L1 6 L0 5 L0 4 L1 3 L4 3",
  ".": "M2 0 L2 1",
  ",": "M2 1 L1 -1",
  "-": "M1 3 L3 3",
  "/": "M0 0 L4 6",
  "(": "M3 0 L2 1 L2 5 L3 6",
  ")": "M1 0 L2 1 L2 5 L1 6",
  "=": "M0 2 L4 2 M0 4 L4 4",
  ":": "M2 1 L2 2 M2 4 L2 5",
  "'": "M2 6 L2 4",
  " ": "",
};

/** Glyph cell: 4 wide and 6 high, advancing 6. */
export const CELL = { w: 4, h: 6, advance: 6 };

/**
 * A glyph's strokes.
 * @param {string} ch
 * @returns {{ draw: boolean; x: number; y: number }[]}
 */
export function strokes(ch) {
  const src = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? "";
  return [...src.matchAll(/([ML])\s*(-?\d+)\s+(-?\d+)/g)].map((m) => ({ draw: m[1] === "L", x: Number(m[2]), y: Number(m[3]) }));
}
