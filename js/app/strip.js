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

/** Closer than this to a knob's centre, in pixels, the pointer's angle is too unsteady to follow. */
const DEAD_PX = 4;

/**
 * Turns a knob the way a hand does (U5): the knob follows the pointer's angle round its centre,
 * clockwise up. Once grabbed, the pointer may circle as wide as it likes, and the wider, the
 * finer. Shared by the strip's dials and the desk's in 3D (P2).
 * @param {() => [number, number]} center the knob's centre on the screen
 * @param {() => number} get the dial's value, -1..1
 * @param {(v: number) => void} set
 * @returns {{ start: (x: number, y: number) => void; move: (x: number, y: number) => void }}
 */
export function turner(center, get, set) {
  /** @type {number | null} */
  let last = null;
  let v = 0;
  /** @param {number} x @param {number} y @returns {number | null} radians clockwise from up */
  const angle = (x, y) => {
    const [cx, cy] = center();
    return Math.hypot(x - cx, y - cy) < DEAD_PX ? null : Math.atan2(x - cx, cy - y);
  };
  const perRadian = 1 / ((DIAL_TRAVEL_DEG * Math.PI) / 180);
  return {
    start(x, y) {
      v = get();
      last = angle(x, y);
    },
    move(x, y) {
      const a = angle(x, y);
      if (a === null) return;
      if (last !== null) {
        let d = a - last;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        v = Math.max(-1, Math.min(1, v + d * perRadian));
        set(v);
      }
      last = a;
    },
  };
}
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
    // turned round its centre, as a hand turns a knob (U5)
    const knob = turner(
      () => {
        const r = /** @type {SVGElement} */ (b.querySelector("svg")).getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      },
      () => machine().dev.dials[n],
      set,
    );
    b.addEventListener("pointerdown", (e) => {
      b.setPointerCapture(e.pointerId);
      knob.start(e.clientX, e.clientY);
      /** @param {PointerEvent} m */
      const move = (m) => knob.move(m.clientX, m.clientY);
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
