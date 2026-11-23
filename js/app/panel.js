// SPDX-License-Identifier: Apache-2.0
//
// The Panel tab in the dock (docs/ui-design.md, U18): the DPR-2's operator's control panel laid
// out as the overview's figure 7 redraws it (SRM5 DPR3 p. 12): BR's 30 lamp-buttons, the 30 PRI
// switches, the machine's buttons, the request selector, PULSE 1, RESET BR and the second OFF.
// The same controls are on the processor rack in 3D; both act through act() below (R21).

import { t } from "../l10n/l10n.js";
import { disassemble } from "../sim/dpr2.js";
import { bitOf, LAMPED, PANEL_SIZE, panelLayout, PRI_USUAL } from "../sim/panel.js";
import { el, setTip } from "../ui/components.js";
import { hi, lo, oct } from "../sim/words.js";

/** @typedef {import("../sim/agt.js").Agt30} Agt30 */
/** @typedef {import("../sim/panel.js").Outcome} Outcome */

/** The tab's scale: CSS pixels per pixel of the manual's photograph (a panel 896 px wide). */
const SCALE = 0.72;
/** How often the lamps are redrawn while the pane is shown, ms. */
const REDRAW_MS = 50;

/** @param {number} w a word as its two halves in octal */
const halves = (w) => `${oct(hi(w), 5)} ${oct(lo(w), 5)}`;

/**
 * What PULSE 1 did, as the status line says it.
 * @param {Agt30} agt
 * @param {Outcome} r
 * @returns {string}
 */
export function pulseText(agt, r) {
  const p = agt.panel;
  if (r === "off") return t("panel.say.off");
  if (r === "hub") return t("panel.say.hub", { pos: t(`panel.sel.${p.selector}`) });
  if (r === "monitor") return t("panel.say.monitor");
  if (r === "started") return t(p.running ? "panel.say.started.run" : "panel.say.started", { addr: oct(agt.cpu.LC, 5) });
  if (r === "halted") return t("panel.say.halted");
  if (r === "waiting") return t("panel.say.waiting");
  return t("panel.say.served", { ins: disassemble(p.pri) });
}

/**
 * Works a control of the panel, from the dock or the rack in 3D, and says what it did.
 * @param {Agt30} agt
 * @param {string} id "br.N", "pri.N", or a control's name (BUTTONS, resetbr, selector, pulse1, off1, usual)
 * @param {boolean} down pressed, or released (only PULSE 1 is held)
 * @param {(msg: string) => void} say
 */
export function act(agt, id, down, say) {
  const p = agt.panel;
  if (id === "pulse1") {
    const r = agt.setPulse1(down);
    if (r) say(pulseText(agt, r));
    return;
  }
  if (!down) return;
  const [kind, n] = id.split(".");
  /** @param {Outcome} r @param {() => string} msg */
  const tell = (r, msg) => say(r === "off" ? t("panel.say.off") : msg());
  if (kind === "br") return tell(p.pressBR(Number(n)), () => t("panel.say.br", { n: Number(n) }));
  if (kind === "pri") {
    p.togglePri(Number(n));
    return say(t("panel.say.pri", { word: halves(p.pri), ins: disassemble(p.pri) }));
  }
  switch (id) {
    case "usual":
      p.setPri(PRI_USUAL);
      return say(t("panel.say.usual"));
    case "resetbr":
      return tell(p.resetBR(), () => t("panel.say.resetbr"));
    case "selector":
      p.turnSelector();
      return say(t("panel.say.selector", { pos: t(`panel.sel.${p.selector}`) }));
    case "run":
      return tell(p.run(), () => t("panel.say.run"));
    case "halt":
      return tell(p.halt(), () => t("panel.say.halt"));
    case "pause":
      return tell(p.pause(), () => t("panel.say.pause"));
    case "step":
    case "cycle": {
      const r = id === "step" ? p.step() : p.cycle();
      const pre = id === "cycle" ? `${t("panel.say.cycle")} ` : "";
      if (r === "off") return say(t("panel.say.off"));
      if (r === "nothing") return say(pre + (p.mode === "run" ? t("panel.say.step.running") : t("panel.say.step.nothing")));
      if (r === "stepped") return say(pre + t("panel.say.stepped", { addr: oct(agt.cpu.last, 5), ins: disassemble(agt.core.read(agt.cpu.last)) }));
      if (r === "ended") return say(pre + t("panel.say.ended"));
      return say(pre + pulseText(agt, r));
    }
    case "reset":
      return tell(p.reset(), () => t("panel.say.reset"));
    case "off0":
    case "off1": {
      const r = p.off(id === "off0" ? 0 : 1);
      return say(r === "armed" ? t("panel.say.armed") : r === "off" ? t("panel.say.off") : t("panel.say.poweroff"));
    }
    case "on":
      return say(p.on() === "ok" ? t("panel.say.alreadyOn") : t("panel.say.on"));
    case "btsp":
      return tell(p.bootstrap(), () => (p.btsp ? t("panel.say.btsp.on") : t("panel.say.btsp.off")));
    case "te":
      return say(t("panel.say.te"));
    case "ic0":
    case "ic1": {
      const bit = id === "ic0" ? 0 : 1;
      return tell(p.toggleIC(bit), () => t("panel.say.ic", { bit, v: bitOf(agt.cpu.IC, bit) ? 1 : 0 }));
    }
  }
}

/**
 * Builds the Panel pane.
 * @param {HTMLElement} host
 * @param {() => Agt30} machine
 * @param {(msg: string) => void} say
 * @param {() => boolean} shown whether the pane is in view
 * @returns {{ render: (force?: boolean) => void }}
 */
export function buildPanel(host, machine, say, shown) {
  /** @type {HTMLButtonElement[]} */
  const brLamps = [];
  /** @type {HTMLButtonElement[]} */
  const priSwitches = [];
  /** @type {Map<string, HTMLButtonElement>} */
  const lamped = new Map();

  /** @param {string} id @param {HTMLButtonElement} b */
  const wire = (id, b) => {
    if (id === "pulse1") {
      // held as long as it is pressed, as on the console
      b.addEventListener("pointerdown", (e) => {
        if (e.button) return;
        b.setPointerCapture(e.pointerId);
        act(machine(), id, true, say);
      });
      const up = () => act(machine(), id, false, say);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("keydown", (e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          act(machine(), id, true, say);
        }
      });
      b.addEventListener("keyup", (e) => {
        if (e.key === " " || e.key === "Enter") act(machine(), id, false, say);
      });
      return b;
    }
    b.addEventListener("click", () => {
      act(machine(), id, true, say);
      render(true);
    });
    return b;
  };

  // the face, drawn from the layout measured on the manual's photograph, scaled (U18)
  const face = el("div", { class: "ocp", role: "group", "aria-label": t("panel.name") });
  face.style.width = `${PANEL_SIZE.w * SCALE}px`;
  face.style.height = `${PANEL_SIZE.h * SCALE}px`;
  /** @param {HTMLElement} e @param {number} x @param {number} y @param {number} [w] @param {number} [h] */
  const place = (e, x, y, w, h) => {
    e.style.left = `${x * SCALE}px`;
    e.style.top = `${y * SCALE}px`;
    if (w !== undefined) e.style.width = `${w * SCALE}px`;
    if (h !== undefined) e.style.height = `${h * SCALE}px`;
    face.append(e);
    return e;
  };
  /** @type {HTMLButtonElement | null} */
  let selector = null;
  for (const it of panelLayout()) {
    if (it.kind === "cell") {
      const c = place(el("div", { class: `ocp-cell r${it.row} c${it.col}` }), it.x, it.y, it.w, it.h);
      if (it.col === 0 && it.row < 2) setTip(c, t(it.row === 0 ? "panel.br.tip" : "panel.pri.tip"));
      continue;
    }
    if (it.kind === "text") {
      const e = place(el("span", { class: `ocp-text ${it.tone} ${it.align}`, text: it.text, "aria-hidden": "true" }), it.x, it.y);
      e.style.fontSize = `${it.size * SCALE}px`;
      continue;
    }
    const n = Number(it.id.split(".")[1]);
    /** @type {HTMLButtonElement} */
    let b;
    if (it.kind === "lamp") {
      b = /** @type {HTMLButtonElement} */ (el("button", { type: "button", class: "ocp-lamp", "aria-label": t("panel.br.bit", { n }) }));
      brLamps[n] = b;
    } else if (it.kind === "switch") {
      b = /** @type {HTMLButtonElement} */ (el("button", { type: "button", class: "ocp-toggle", role: "switch", "aria-checked": "false", "aria-label": t("panel.pri.bit", { n }) }, [el("span", { class: "ocp-lever" })]));
      priSwitches[n] = b;
    } else if (it.kind === "selector") {
      b = /** @type {HTMLButtonElement} */ (el("button", { type: "button", class: "ocp-knob" }, [el("span", { class: "ocp-pointer" })]));
      setTip(b, t("panel.selector.tip"));
      selector = b;
    } else {
      b = /** @type {HTMLButtonElement} */ (el("button", { type: "button", class: "ocp-lamp ocp-btn", "aria-label": t(`panel.${it.id}`) }));
      setTip(b, t(`panel.${it.id}.tip`));
      if (it.id in LAMPED) lamped.set(it.id, b);
    }
    wire(it.id, b);
    place(b, it.x, it.y, it.d, it.d);
  }
  const knob = /** @type {HTMLButtonElement} */ (selector);
  const word = el("span", { class: "ocp-word mono" });
  const usual = /** @type {HTMLButtonElement} */ (el("button", { type: "button", class: "btn small tonal" }, [el("span", { text: t("panel.usual") })]));
  setTip(usual, t("panel.usual.tip"));
  wire("usual", usual);
  const state = el("span", { class: "ocp-state" });
  host.replaceChildren(
    el("div", { class: "ocp-bar" }, [word, usual, el("span", { class: "spacer" }), state]),
    el("div", { class: "ocp-scroll" }, [face]),
  );

  let last = 0;
  /** @type {string} */
  let lastKey = "";
  /** @param {boolean} [force] */
  function render(force = false) {
    if (!shown()) return;
    const now = performance.now();
    if (!force && now - last < REDRAW_MS) return;
    last = now;
    const agt = machine();
    const p = agt.panel;
    const lamps = /** @type {Record<string, boolean>} */ (p.lamps());
    const br = p.br;
    const key = [br, p.pri, p.selector, Object.values(lamps).join()].join("|");
    if (!force && key === lastKey) return;
    lastKey = key;
    brLamps.forEach((b, i) => b.classList.toggle("lit", bitOf(br, i)));
    priSwitches.forEach((b, i) => b.setAttribute("aria-checked", String(bitOf(p.pri, i))));
    for (const [id, b] of lamped) b.classList.toggle("lit", lamps[LAMPED[id]]);
    knob.dataset.pos = p.selector;
    word.textContent = t("panel.word", { word: halves(p.pri), ins: disassemble(p.pri) });
    usual.hidden = p.pri === PRI_USUAL;
    state.textContent = (p.power ? t(`panel.state.${p.mode}`) : t("panel.state.off")) + (p.btsp ? ` · ${t("panel.state.btsp")}` : "");
  }
  render(true);
  return { render };
}
