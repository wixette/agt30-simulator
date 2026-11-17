// SPDX-License-Identifier: Apache-2.0
//
// The Processor tab in the dock (docs/ui-design.md, U15): the DPR-2's registers and its priority
// interrupts, and a listing of core with the assembler's symbols, read as instructions, as
// DSPLY's image items, or as words. It only looks: nothing here changes the machine (the
// monitor's OPEN does that). A view the real AGT never had (P9).

import { t, num } from "../l10n/l10n.js";
import { listing, MODES, namesByAddress, parseAddress } from "../sim/listing.js";
import { hi, lo, oct } from "../sim/words.js";

/** @typedef {import("../sim/agt.js").Agt30} Agt30 */
/** @typedef {import("../sim/listing.js").Mode} Mode */

/** How often the pane is drawn while the machine runs, ms. */
const REDRAW_MS = 100;
/** Lines drawn: more than the tallest dock shows; the rest is clipped. */
const LINES = 96;
/** With Follow on, at most how many lines are shown above LC's. */
const ABOVE = 4;
/** A line's height in the listing, px (css/style.css, .proc-list). */
const LINE_PX = 18;

/** @param {string} s */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** @param {number} w a 30-bit word as its two halves in octal */
const halves = (w) => `${oct(hi(w), 5)} ${oct(lo(w), 5)}`;

/**
 * Wires the Processor pane.
 * @param {() => Agt30} machine
 * @param {(msg: string) => void} say
 * @param {() => boolean} shown whether the pane is in view
 * @returns {{ render: (force?: boolean) => void }}
 */
export function buildProcessor(machine, say, shown) {
  const goto = /** @type {HTMLInputElement} */ (document.getElementById("proc-goto"));
  const follow = /** @type {HTMLButtonElement} */ (document.getElementById("proc-follow"));
  const regs = /** @type {HTMLElement} */ (document.getElementById("proc-regs"));
  const state = /** @type {HTMLElement} */ (document.getElementById("proc-state"));
  const list = /** @type {HTMLElement} */ (document.getElementById("proc-list"));
  goto.placeholder = t("proc.goto.placeholder");
  /** @type {HTMLElement} */ (document.getElementById("proc-modes")).setAttribute("aria-label", t("proc.modes"));
  const modeButtons = /** @type {HTMLButtonElement[]} */ (MODES.map((m) => document.getElementById(`proc-mode-${m}`)));
  /** @type {Mode} */
  let mode = "code";
  let following = true;
  let anchor = 0;
  let last = 0;

  const setFollow = (/** @type {boolean} */ on) => {
    following = on;
    follow.setAttribute("aria-checked", String(on));
  };
  const setMode = (/** @type {Mode} */ m) => {
    mode = m;
    modeButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(MODES[i] === m)));
    render(true);
  };
  /** @param {number} a */
  const jump = (a) => {
    setFollow(false);
    anchor = a;
    render(true);
  };

  modeButtons.forEach((b, i) => b.addEventListener("click", () => setMode(MODES[i])));
  follow.addEventListener("click", () => {
    setFollow(!following);
    render(true);
  });
  const go = () => {
    const a = parseAddress(goto.value, machine().core);
    if (a === null) {
      say(t("proc.goto.none", { text: goto.value.trim().toUpperCase() }));
      return;
    }
    jump(a);
    say(t("proc.goto.done", { addr: oct(a, 5) }));
  };
  goto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  });
  /** @type {HTMLElement} */ (document.getElementById("proc-go")).addEventListener("click", go);
  list.addEventListener("click", (e) => {
    const ref = /** @type {HTMLElement} */ (e.target).closest("[data-ref]");
    if (ref) jump(parseInt(/** @type {string} */ (ref.getAttribute("data-ref")), 8));
  });
  // the wheel and the arrow keys move through core; either turns Follow off
  /** @param {number} d lines */
  const move = (d) => jump((anchor + d) & 0o77777);
  list.addEventListener("wheel", (e) => {
    e.preventDefault();
    move(Math.sign(e.deltaY) * 3);
  }, { passive: false });
  list.addEventListener("keydown", (e) => {
    const d = { ArrowUp: -1, ArrowDown: 1, PageUp: -16, PageDown: 16 }[e.key];
    if (!d) return;
    e.preventDefault();
    move(d);
  });

  /** @param {boolean} [force] */
  function render(force = false) {
    if (!shown()) return;
    const now = performance.now();
    if (!force && now - last < REDRAW_MS) return;
    last = now;
    const agt = machine();
    const cpu = agt.cpu;
    // with Follow on, LC's line sits a third of the way down whatever height the dock has
    const rows = Math.max(1, Math.floor(list.clientHeight / LINE_PX));
    if (following) anchor = (cpu.LC - Math.min(ABOVE, Math.floor(rows / 3))) & 0o77777;
    regs.textContent = [
      `LC ${oct(cpu.LC, 5)}`,
      `AR ${halves(cpu.AR)}`,
      `BR ${halves(cpu.BR)}`,
      `IC ${halves(cpu.IC)}`,
      `S4 ${halves(cpu.S4)}`,
      `ER ${oct(lo(cpu.ER), 5)}`,
    ].join("   ");
    const pri = cpu.pri;
    const chans = (/** @type {Iterable<number>} */ c) => [...c].sort((a, b) => a - b).join(", ");
    state.textContent = [
      agt.program ? t("proc.running", { name: agt.program.name }) : t("proc.idle"),
      pri.frozen ? t("proc.pri.frozen") : t("proc.pri.open"),
      pri.service.length ? t("proc.pri.service", { channels: chans(pri.service) }) : null,
      pri.pending.size ? t("proc.pri.waiting", { channels: chans(pri.pending.keys()) }) : null,
      t("proc.count", { n: num(cpu.instructions) }),
    ].filter(Boolean).join(" · ");
    const lines = listing(agt.core, anchor, LINES, mode, namesByAddress(agt.core));
    list.innerHTML = lines
      .map((l) => {
        const here = l.addr === cpu.LC ? " here" : "";
        const label = l.label ? esc(`${l.label}:`) : "";
        const words = l.words.map(halves).join("  ");
        const operand = l.ref === null ? esc(l.operand) : `<button type="button" class="proc-ref" data-ref="${oct(l.ref, 5)}">${esc(l.operand)}</button>`;
        return `<div class="proc-line${here}"><span class="proc-addr">${oct(l.addr, 5)}</span><span class="proc-label">${label}</span><span class="proc-words">${words}</span><span class="proc-text">${esc(l.text)} ${operand}</span></div>`;
      })
      .join("");
  }

  setMode("code");
  setFollow(true);
  return { render };
}
