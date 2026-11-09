// SPDX-License-Identifier: Apache-2.0
//
// The Teletype in the dock (docs/ui-design.md, U9): the paper and the keyboard, after the 8800
// simulator's ASR-33. The paper is the machine's model (js/sim/teletype.js); this draws it, with
// the carriage where it really is, and sends the keys typed while it has the focus. Lower case
// goes as upper case; the ASR-33 had none.

/** @typedef {import("../sim/agt.js").Agt30} Agt30 */

/** The AMOS monitor's own editing characters (js/sim/amos.js): rub out, and kill the line. */
export const RUBOUT = "\b";
export const KILL = "\x15";

/**
 * The character a key sends, or null.
 * @param {KeyboardEvent} e
 * @returns {string | null}
 */
export function keyToChar(e) {
  if (e.metaKey || e.altKey) return null;
  if (e.ctrlKey) return e.key === "u" || e.key === "U" ? KILL : null;
  if (e.key === "Enter") return "\r";
  if (e.key === "Backspace" || e.key === "Delete") return RUBOUT;
  if (e.key === "Escape") return null;
  if (e.key.length !== 1) return null;
  const c = e.key.toUpperCase();
  return c.charCodeAt(0) < 0x80 ? c : null;
}

/**
 * Wires the Teletype pane.
 * @param {() => Agt30} machine
 * @param {() => void} onPrint called when something new is on the paper
 * @returns {{ render: () => void }}
 */
export function buildTeletype(machine, onPrint) {
  const paper = /** @type {HTMLElement} */ (document.getElementById("tty-paper"));
  const text = /** @type {HTMLElement} */ (document.getElementById("tty-text"));
  const empty = /** @type {HTMLElement} */ (document.getElementById("tty-empty"));
  /** @param {string} s */
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let shown = "";
  let column = -1;

  paper.addEventListener("keydown", (e) => {
    const ch = keyToChar(e);
    if (ch === null) return;
    e.preventDefault();
    machine().type(ch);
  });
  /** @type {HTMLElement} */ (document.getElementById("tty-rubout")).addEventListener("click", () => {
    machine().type(RUBOUT);
    paper.focus();
  });
  /** @type {HTMLElement} */ (document.getElementById("tty-kill")).addEventListener("click", () => {
    machine().type(KILL);
    paper.focus();
  });
  /** @type {HTMLElement} */ (document.getElementById("tty-clear")).addEventListener("click", () => {
    machine().paper.clear();
    render();
  });

  function render() {
    const tty = machine().paper;
    const all = tty.getText();
    if (all === shown && tty.column === column) return;
    const grew = all.length > shown.length;
    shown = all;
    column = tty.column;
    const lines = tty.lines;
    const out = lines.slice(0, -1).map(esc);
    let last = lines[lines.length - 1];
    if (last.length < tty.column) last += " ".repeat(tty.column - last.length);
    out.push(`${esc(last.slice(0, tty.column))}<span class="tty-cursor">${esc(last.charAt(tty.column) || " ")}</span>${esc(last.slice(tty.column + 1))}`);
    text.innerHTML = out.join("\n");
    empty.hidden = !(lines.length === 1 && lines[0] === "" && tty.column === 0);
    paper.scrollTop = paper.scrollHeight;
    if (grew) onPrint();
  }
  render();
  return { render };
}
