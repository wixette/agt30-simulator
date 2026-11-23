// SPDX-License-Identifier: Apache-2.0
//
// The Panel tab in the dock (docs/ui-design.md, U18): the DPR-2's operator's control panel laid
// out as the overview's figure 7 redraws it (SRM5 DPR3 p. 12): BR's 30 lamp-buttons, the 30 PRI
// switches, the machine's buttons, the request selector, PULSE 1, RESET BR and the second OFF.
// The same controls are on the processor rack in 3D; both act through act() below (R21).

import { t } from "../l10n/l10n.js";
import { disassemble } from "../sim/dpr2.js";
import { bitOf, BUTTONS, LAMPED, PRI_USUAL } from "../sim/panel.js";
import { el, setTip } from "../ui/components.js";
import { hi, lo, oct } from "../sim/words.js";

/** @typedef {import("../sim/agt.js").Agt30} Agt30 */
/** @typedef {import("../sim/panel.js").Outcome} Outcome */

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

  /** A bit's cell: its number above its lamp or switch. @param {number} bit @param {"br" | "pri"} kind */
  const cell = (bit, kind) => {
    const b = /** @type {HTMLButtonElement} */ (
      kind === "br"
        ? el("button", { type: "button", class: "ocp-lamp", "aria-label": t("panel.br.bit", { n: bit }) })
        : el("button", { type: "button", class: "ocp-toggle", role: "switch", "aria-checked": "false", "aria-label": t("panel.pri.bit", { n: bit }) }, [el("span", { class: "ocp-thumb" })])
    );
    (kind === "br" ? brLamps : priSwitches)[bit] = wire(`${kind}.${bit}`, b);
    return el("div", { class: "ocp-cell" }, [el("span", { class: "ocp-num", text: String(bit) }), b]);
  };
  /** The five groups of three columns, bits 0-14 above and 15-29 below. @param {"br" | "pri"} kind */
  const bits = (kind) =>
    el("div", { class: "ocp-block" }, Array.from({ length: 5 }, (_, g) =>
      el("div", { class: "ocp-group bits" }, [0, 1, 2, 15, 16, 17].map((o) => cell(g * 3 + o, kind)))));
  /** A labeled button, lit if it has a lamp. @param {string} id */
  const button = (id) => {
    const b = /** @type {HTMLButtonElement} */ (el("button", { type: "button", class: "ocp-lamp ocp-btn", "aria-label": t(`panel.${id}`) }));
    setTip(b, t(`panel.${id}.tip`));
    if (id in LAMPED) lamped.set(id, b);
    wire(id, b);
    return el("div", { class: "ocp-cell" }, [el("span", { class: "ocp-name", text: t(`panel.${id}`) }), b]);
  };
  const selector = /** @type {HTMLButtonElement} */ (el("button", { type: "button", class: "ocp-knob" }, [el("span", { class: "ocp-pointer" })]));
  setTip(selector, t("panel.selector.tip"));
  wire("selector", selector);
  const selLabels = /** @type {const} */ (["pulse1", "hub1", "hub2"]).map((s) => el("span", { "data-pos": s, text: t(`panel.sel.${s}`) }));

  const face = el("div", { class: "ocp", role: "group", "aria-label": t("panel.name") }, [
    el("span", { class: "ocp-side", text: t("panel.br") }),
    bits("br"),
    el("div", { class: "ocp-right" }, [button("resetbr")]),
    el("span", { class: "ocp-side", text: t("panel.pri") }),
    bits("pri"),
    el("div", { class: "ocp-right" }, [el("div", { class: "ocp-sel" }, [selector, el("div", { class: "ocp-sel-labels" }, selLabels)]), button("pulse1")]),
    el("span", { class: "ocp-side" }),
    el("div", { class: "ocp-block" }, BUTTONS.map((g) => el("div", { class: "ocp-group" }, g.map(button)))),
    el("div", { class: "ocp-right" }, [button("off1")]),
  ]);
  setTip(/** @type {HTMLElement} */ (face.children[1]), t("panel.br.tip"));
  setTip(/** @type {HTMLElement} */ (face.children[4]), t("panel.pri.tip"));
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
    selector.dataset.pos = p.selector;
    for (const s of selLabels) s.classList.toggle("on", s.dataset.pos === p.selector);
    word.textContent = t("panel.word", { word: halves(p.pri), ins: disassemble(p.pri) });
    usual.hidden = p.pri === PRI_USUAL;
    state.textContent = (p.power ? t(`panel.state.${p.mode}`) : t("panel.state.off")) + (p.btsp ? ` · ${t("panel.state.btsp")}` : "");
  }
  render(true);
  return { render };
}
