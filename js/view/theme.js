// SPDX-License-Identifier: Apache-2.0
//
// The theme's tokens (css/theme.css) for the canvas and three.js views, read from the page so
// that every colour lives in one place (U10).

/**
 * A CSS custom property of the page's root, or a fallback when there is no page (Node).
 * @param {string} name e.g. "--phosphor"
 * @param {string} fallback
 * @returns {string}
 */
export function token(name, fallback) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * A colour as [r, g, b] (0-255), given as #rrggbb or #rgb.
 * @param {string} color
 * @returns {[number, number, number]}
 */
export function rgbOf(color) {
  let h = color.trim().replace(/^#/, "");
  if (h.length === 3) h = [...h].map((x) => x + x).join("");
  const n = /^[0-9a-f]{6}$/i.test(h) ? parseInt(h, 16) : 0x7dff9b;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
