// SPDX-License-Identifier: Apache-2.0
//
// The AMOS internal 6-bit character code, single case (AMRMX pp. 20-21), with the Teletype's
// characters: five characters to a 30-bit word, left-justified, filled with nulls (code 00).
// Image headers, monitor strings ("ABCDE") and TEXT in ADEPT use it.

/** The Teletype's character for each code 00-77 (octal). Null prints as "[", as on the TTY. */
export const TTY = [
  "[", "%", "]", "!", "&", "*", ":", "\\", "+", "\t", "?", '"', "'", "\r", "(", ")",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ";", "=", ",", "-", ".", "/",
  " ", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
  "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "$", "#", "@", "↑", "←",
];

/** @type {Map<string, number>} */
const CODE = new Map(TTY.map((c, i) => [c, i]));
CODE.set("\n", 0o15);
CODE.set("^", 0o76);
CODE.set("_", 0o77);

/**
 * The 6-bit code of a character (lower case is folded to upper; unknown characters give null).
 * @param {string} ch
 * @returns {number}
 */
export const amosCode = (ch) => CODE.get(ch.toUpperCase()) ?? 0;

/**
 * Packs text into words, five characters each, left-justified, null-filled.
 * @param {string} text
 * @param {number} [minWords] pad with null words to at least this many
 * @returns {number[]}
 */
export function packText(text, minWords = 0) {
  const words = [];
  for (let i = 0; i < Math.max(text.length, minWords * 5); i += 5) {
    let w = 0;
    for (let j = 0; j < 5; j++) w = w * 64 + (i + j < text.length ? amosCode(text[i + j]) : 0);
    words.push(w);
  }
  while (words.length < minWords) words.push(0);
  return words;
}

/**
 * Unpacks words into text, stopping at the first null.
 * @param {number[]} words
 * @returns {string}
 */
export function unpackText(words) {
  let s = "";
  for (const w of words) {
    for (let j = 4; j >= 0; j--) {
      const c = Math.floor(w / 64 ** j) % 64;
      if (c === 0) return s;
      s += TTY[c];
    }
  }
  return s;
}
