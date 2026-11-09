// SPDX-License-Identifier: Apache-2.0
//
// The console strip (docs/ui-design.md, U5): the six dials, the sixteen function keys and the
// light pen's state, laid out as the console lays them out. A control here and the same control
// on the desk in 3D are two ways to one operation (P2): both call the machine's setDial and
// setKey. Its words come from the messages (U11).

import { el, setTip } from "../ui/components.js";
import { t } from "../l10n/l10n.js";
import { DIALS, KEYS } from "../sim/agt.js";
import { DIAL_TRAVEL_DEG } from "../scene/viewer.js";

/** Pixels of vertical drag for the whole travel, end to end (the same on the desk in 3D). */
export const DRAG_PX = 240;
/** One arrow key's step, and one wheel notch's. */
const STEP = 1 / 64;

/** @typedef {import("../sim/agt.js").Agt30} Agt30 */

/**
 * Builds the strip.
 * @param {HTMLElement} host
 * @param {() => Agt30} machine
 * @param {(msg: string) => void} say the status line
 * @returns {{ update: () => void; setPen: (on: boolean) => void }}
 */
export function buildStrip(host, machine, say) {
  host.setAttribute("aria-label", t("part.console.desk"));
  /** @type {SVGLineElement[]} */
  const pointers = [];
  /** @type {HTMLButtonElement[]} */
  const dialButtons = [];
  const dials = el("div", { class: "dials" });
  for (let n = 0; n < DIALS; n++) {
    const b = el("button", { class: "dial", type: "button", role: "slider", "aria-valuemin": "-1", "aria-valuemax": "1", "aria-valuenow": "0", "aria-label": t("strip.dial", { n }) });
    b.innerHTML = `<svg viewBox="-20 -20 40 40" aria-hidden="true"><circle class="knob" r="16"/><line class="pointer" x1="0" y1="-4" x2="0" y2="-14"/></svg><span class="n">${n}</span>`;
    pointers.push(/** @type {SVGLineElement} */ (b.querySelector(".pointer")));
    setTip(b, t("strip.dial.tip", { n }));
    /** @param {number} v */
    const set = (v) => {
      machine().setDial(n, v);
      say(t("status.dial", { n, v: machine().dev.dials[n].toFixed(3) }));
    };
    // a vertical drag turns it (U5; the drag round the knob was the alternative)
    b.addEventListener("pointerdown", (e) => {
      b.setPointerCapture(e.pointerId);
      const y0 = e.clientY;
      const v0 = machine().dev.dials[n];
      /** @param {PointerEvent} m */
      const move = (m) => set(v0 + ((y0 - m.clientY) * 2) / DRAG_PX);
      const up = () => {
        b.removeEventListener("pointermove", move);
        b.removeEventListener("pointerup", up);
        b.removeEventListener("pointercancel", up);
      };
      b.addEventListener("pointermove", move);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
    });
    b.addEventListener("wheel", (e) => {
      e.preventDefault();
      set(machine().dev.dials[n] - Math.sign(e.deltaY) * STEP);
    });
    b.addEventListener("keydown", (e) => {
      const d = { ArrowUp: STEP, ArrowRight: STEP, ArrowDown: -STEP, ArrowLeft: -STEP, PageUp: 8 * STEP, PageDown: -8 * STEP }[e.key];
      if (d === undefined && e.key !== "Home") return;
      e.preventDefault();
      set(e.key === "Home" ? 0 : machine().dev.dials[n] + (d ?? 0));
    });
    dialButtons.push(b);
    dials.append(b);
  }

  // the function switch box: a 4 x 4 grid, its last column set apart (FNS1)
  const keys = el("div", { class: "keys" });
  /** @type {HTMLButtonElement[]} */
  const keyButtons = [];
  for (let n = 0; n < KEYS; n++) {
    const row = Math.floor(n / 4);
    const col = n % 4;
    const b = el("button", { class: "fkey", type: "button", "aria-pressed": "false", "aria-label": t("strip.key", { n }), text: String(n) });
    b.style.gridRow = String(row + 1);
    b.style.gridColumn = String(col < 3 ? col + 1 : 5);
    setTip(b, t("strip.key.tip", { n }));
    /** @param {boolean} down */
    const press = (down) => {
      machine().setKey(n, down);
      b.setAttribute("aria-pressed", String(down));
      if (down) say(t("status.key", { n }));
    };
    b.addEventListener("pointerdown", (e) => {
      b.setPointerCapture(e.pointerId);
      press(true);
    });
    for (const ev of ["pointerup", "pointercancel"]) b.addEventListener(ev, () => press(false));
    b.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        press(true);
      }
    });
    b.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") press(false);
    });
    b.addEventListener("blur", () => b.getAttribute("aria-pressed") === "true" && press(false));
    keyButtons.push(b);
    keys.append(b);
  }

  const penText = el("span", { text: t("strip.pen.off") });
  const pen = el("div", { class: "pen", "aria-disabled": "true" }, [penText]);
  setTip(pen, t("strip.pen.tip"));
  pen.addEventListener("click", () => pen.getAttribute("aria-disabled") === "true" && say(t("status.penOff")));

  host.replaceChildren(
    el("div", { class: "strip-group" }, [el("span", { class: "strip-label", text: t("strip.dials") }), dials]),
    el("div", { class: "strip-sep" }),
    el("div", { class: "strip-group" }, [el("span", { class: "strip-label", text: t("strip.keys") }), keys]),
    el("div", { class: "strip-sep" }),
    el("div", { class: "strip-group" }, [el("span", { class: "strip-label", text: t("strip.pen") }), pen]),
  );

  return {
    update() {
      const agt = machine();
      for (let n = 0; n < DIALS; n++) {
        const v = agt.dev.dials[n];
        pointers[n].setAttribute("transform", `rotate(${v * DIAL_TRAVEL_DEG})`);
        dialButtons[n].setAttribute("aria-valuenow", v.toFixed(3));
      }
    },
    setPen(on) {
      pen.setAttribute("aria-disabled", String(!on));
      penText.textContent = t(on ? "strip.pen.on" : "strip.pen.off");
    },
  };
}
