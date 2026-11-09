// SPDX-License-Identifier: Apache-2.0
//
// The stage (docs/ui-design.md, Part 2): the machine at one viewpoint at a time, with the band
// (the breadcrumb and the view tools), a part's card, and, at the end of some flights, a 2D
// surface. Room, Console, Screen and Tube (V1-V8): the camera flies (V2); the Screen is the
// full-resolution 2D picture, where the light pen works (V3); the Tube has its time, its traces
// and a live inset of the screen (V4, V5); under Screen the 3D view stops rendering (V8).

import * as THREE from "three";
import { el, icon, setTip, showMenu } from "../ui/components.js";
import { t } from "../l10n/l10n.js";
import { CrtView } from "../view/crt.js";
import { phosphorById } from "../view/phosphor.js";
import { TracesView } from "../view/traces.js";
import { TerminalView } from "../scene/viewer.js";
import { v3, boxOf } from "../scene/terminal3d.js";
import { DRAG_PX } from "./strip.js";

/** @typedef {import("./link.js").View} View */
/** @typedef {{ view?: View; look?: true; label: string }} CardAction a card's button: a viewpoint, or a close look */
/** @typedef {import("../scene/viewer.js").Pose} Pose */
/** @typedef {import("../scene/terminal3d.js").TerminalParams} TerminalParams */
/** @typedef {import("../sim/agt.js").Agt30} Agt30 */

/** Each viewpoint's parent, for the breadcrumb and for Escape (V2). */
const PARENT = /** @type {Record<View, View | null>} */ ({ room: null, console: "room", screen: "console", tube: "console" });
/** The time a Tube visit starts in (the table in Part 2). */
export const TUBE_SCALE = 0.00001;
/** The parts the Console viewpoint frames: the desktop and what stands on it, as the operator sees them. */
const CONSOLE_PARTS = ["console.scope", "console.dials", "console.fns", "console.joystick", "console.pen"];
/** The parts that have no control in the strip in v0.0.1 (U5). */
const NOT_IN_STRIP = new Set(["console.joystick", "console.pedals"]);

/**
 * @typedef {object} StageOps
 * @property {() => Agt30} machine
 * @property {(msg: string) => void} say
 * @property {(view: View) => void} onView a viewpoint was chosen
 * @property {(scale: number) => void} setScale
 * @property {(on: boolean) => void} setPen
 */

export class Stage {
  /**
   * @param {TerminalParams} params
   * @param {StageOps} ops
   * @param {string | null} phosphorId
   */
  constructor(params, ops, phosphorId) {
    this.params = params;
    this.ops = ops;
    /** @type {View} */
    this.view = "room";
    /** @type {string | null} the part or cable a close look frames, within the viewpoint */
    this.closeLook = null;
    this.stage = /** @type {HTMLElement} */ (document.getElementById("stage"));
    this.card = /** @type {HTMLElement} */ (document.getElementById("card"));
    this.screenEl = /** @type {HTMLElement} */ (document.getElementById("screen"));
    this.tubeEl = /** @type {HTMLElement} */ (document.getElementById("tube-overlay"));
    this.view3dEl = /** @type {HTMLElement} */ (document.getElementById("view3d"));
    // the CRT views: the 3D face's texture, the Screen, the Tube's inset; one phosphor (R14)
    this.faceCanvas = document.createElement("canvas");
    this.faceCrt = new CrtView(this.faceCanvas, { size: 512 });
    this.screenCrt = new CrtView(/** @type {HTMLCanvasElement} */ (document.getElementById("crt")));
    this.insetCrt = new CrtView(/** @type {HTMLCanvasElement} */ (document.getElementById("inset-crt")), { size: 256 });
    this.setPhosphor(phosphorId);
    this.traces = new TracesView(/** @type {HTMLCanvasElement} */ (document.getElementById("traces")), {
      x: t("trace.x"),
      y: t("trace.y"),
      z: t("trace.z"),
      empty: t("trace.empty"),
      status: (state, us, total, fps, rate) => t(`trace.${state}`, { us: us.toFixed(1), total: total.toFixed(0), ms: (1000 / fps).toFixed(0), fps: fps.toFixed(0), rate }),
    });
    /** @type {TerminalView | null} */
    this.view3d = null;
    try {
      this.view3d = new TerminalView(this.view3dEl, params, this.faceCanvas);
    } catch {
      ops.say(t("app.noWebgl"));
    }
    if (this.view3d) {
      this.view3d.onPick = (name) => this.openCard(name);
      /** the dial's value when its drag started */
      let v0 = 0;
      this.view3d.onDial = (n, dy, start) => {
        const agt = this.ops.machine();
        if (start) v0 = agt.dev.dials[n];
        else agt.setDial(n, v0 + (dy * 2) / DRAG_PX);
        this.ops.say(t("status.dial", { n, v: agt.dev.dials[n].toFixed(3) }));
      };
      // a double-click does the card's first action (V1); every part has one, a close look
      this.view3d.onActivate = (name) => {
        const first = this.cardActions(name)[0];
        if (first) this.act(name, first);
      };
    }
    this.wireBand();
    this.wirePen();
    this.wireTube();
    this.stage.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open], .menu")) this.up();
    });
    new ResizeObserver(() => this.refit()).observe(this.stage);
  }

  /**
   * The phosphor every CRT view uses: P31-like, or another by ?phosphor= (R14).
   * @param {string | null} id
   */
  setPhosphor(id) {
    const ph = phosphorById(id);
    for (const c of [this.faceCrt, this.screenCrt, this.insetCrt]) c.setPhosphor(ph);
  }

  // ---- the band ----

  wireBand() {
    const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
    $("home").addEventListener("click", () => this.go(this.view));
    $("zoom-in").addEventListener("click", () => this.view3d?.zoom(0.8));
    $("zoom-out").addEventListener("click", () => this.view3d?.zoom(1.25));
    $("back").addEventListener("click", () => this.up());
  }

  /**
   * The viewpoint menu: one button naming the viewpoint, whose menu lists all four, the current
   * one checked. Its label says what it is, so it has no tooltip. Back and Escape climb a level.
   */
  renderCrumbs() {
    const host = /** @type {HTMLElement} */ (document.getElementById("crumbs"));
    const all = /** @type {View[]} */ (Object.keys(PARENT));
    const b = el("button", { class: "crumb", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": t("view.choose", { view: t(`view.${this.view}`) }) }, [
      el("span", { text: t(`view.${this.view}`) }),
      icon("keyboard_arrow_down"),
    ]);
    b.addEventListener("click", () => showMenu(b, all.map((v) => ({ label: t(`view.${v}`), checked: v === this.view, run: () => this.go(v) }))));
    host.replaceChildren(b);
    const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
    $("back").hidden = this.view === "room" && !this.closeLook;
    for (const id of ["home", "zoom-in", "zoom-out"]) $(id).hidden = this.view === "screen";
  }

  /** Climbs one level (V2). */
  up() {
    if (this.closeLook) return void this.go(this.view);
    const p = PARENT[this.view];
    if (p) this.go(p);
  }

  // ---- the free area and the framing (U4) ----

  /** @returns {import("../scene/viewer.js").Rect} */
  freeRect() {
    const s = this.stage.getBoundingClientRect();
    const band = /** @type {HTMLElement} */ (document.getElementById("band")).getBoundingClientRect();
    const strip = /** @type {HTMLElement} */ (document.getElementById("strip")).getBoundingClientRect();
    const top = band.bottom - s.top;
    const traces = /** @type {HTMLElement} */ (document.getElementById("traces")).getBoundingClientRect();
    const inset = /** @type {HTMLElement} */ (document.getElementById("inset")).getBoundingClientRect();
    const tube = this.view === "tube";
    const bottom = (tube ? traces.top : strip.top) - s.top;
    // a part's card floats over the stage's edge and is not counted: opening it never moves
    // the view (V1: a click selects, only actions move). A close look, an action, frames its
    // part beside the card, so that the card describing it does not cover it.
    let right = s.width;
    if (this.closeLook && !this.card.hidden) right = this.card.getBoundingClientRect().left - s.left - 8;
    if (tube) right = Math.min(right, inset.left - s.left - 8);
    return { left: 8, top, width: Math.max(80, right - 8), height: Math.max(80, bottom - top) };
  }

  refit() {
    this.view3d?.setFree(this.freeRect());
  }

  /**
   * A box of parts, in three.js metres.
   * @param {string[]} names
   * @returns {THREE.Box3}
   */
  boxOfParts(names) {
    const box = new THREE.Box3();
    for (const n of names) {
      const b = boxOf(this.params, n);
      if (!b) continue;
      box.expandByPoint(v3(b[0], b[1], b[2]));
      box.expandByPoint(v3(b[3], b[4], b[5]));
    }
    return box;
  }

  /**
   * The pose of a viewpoint.
   * @param {View} v
   * @returns {Pose}
   */
  pose(v) {
    const view = /** @type {TerminalView} */ (this.view3d);
    if (v === "room") return view.frame(this.boxOfParts(this.params.parts.map((p) => p.name)), new THREE.Vector3(0.35, 0.32, 1));
    if (v === "console") {
      const box = this.boxOfParts(CONSOLE_PARTS);
      const desk = boxOf(this.params, "console.desk");
      if (desk) box.expandByPoint(v3(desk[0], desk[1], desk[5])).expandByPoint(v3(desk[3], desk[4], desk[5]));
      return view.frame(box, new THREE.Vector3(0, 0.3, 1));
    }
    const face = view.built.face;
    face.geometry.computeBoundingBox();
    const fb = /** @type {THREE.Box3} */ (face.geometry.boundingBox).clone().applyMatrix4(face.matrixWorld);
    if (v === "screen") return view.frame(fb, new THREE.Vector3(0, 0, 1));
    // the Tube: the scope cut open, seen from its left and a little above
    return view.frame(this.boxOfParts(["console.scope"]), new THREE.Vector3(-1, 0.3, 0.6));
  }

  // ---- going to a viewpoint ----

  /**
   * Goes to a viewpoint: the camera flies; a 2D surface cross-fades in at the end of the
   * flight, out at the start of the way back (V2).
   * A card belongs to the part, not to the camera: a viewpoint reached by acting on a part (its
   * card's button, or a double-click) keeps that part's card open, except on the Screen, where
   * no part is shown; a viewpoint chosen by the menu, Back, Home or Escape closes it.
   * @param {View} v
   * @param {boolean} [animate]
   * @param {string | null} [part] the part acted on, whose card stays open
   */
  async go(v, animate = true, part = null) {
    const from = this.view;
    this.view = v;
    this.stage.dataset.view = v;
    this.closeLook = null;
    // the link names the viewpoint chosen, whether or not the camera gets there undisturbed
    this.ops.onView(v);
    // a viewpoint is reached with nothing highlighted: the part it frames is looked at, not marked
    this.view3d?.select(null);
    if (part && v !== "screen") this.openCard(part);
    else this.closeCard();
    this.renderCrumbs();
    // leaving the Screen: the picture fades out, the 3D view comes back
    if (from === "screen" && v !== "screen") {
      this.screenEl.hidden = true;
      if (this.view3d) this.view3d.active = true;
      this.view3dEl.style.opacity = "1";
    }
    this.tubeEl.hidden = v !== "tube";
    this.view3d?.setInside(v === "tube");
    // V5: the Tube owns its time; leaving it puts time back to real
    this.ops.setScale(v === "tube" ? TUBE_SCALE : 1);
    this.markTime(v === "tube" ? TUBE_SCALE : 1);
    this.ops.setPen(v === "screen");
    // the overlays are laid out before the free area is measured; the flight moves the
    // picture's centre to it, in step with the camera
    await new Promise((r) => requestAnimationFrame(r));
    if (animate) this.view3d?.setFreeForFlight(this.freeRect());
    else this.refit();
    if (this.view3d) await this.view3d.goTo(() => this.pose(v), animate);
    if (this.view !== v) return;
    if (v === "screen") {
      this.screenEl.hidden = false;
      this.view3dEl.style.opacity = "0";
      if (this.view3d) this.view3d.active = false;
    }
  }

  // ---- cards (U6) ----

  /**
   * What a part's card offers: the part's own viewpoints, less the one shown, then a close look.
   * @param {string} name
   * @returns {CardAction[]}
   */
  cardActions(name) {
    /** @type {CardAction[]} */
    let list = [];
    if (name === "console.scope") list = [{ view: "screen", label: t("card.goScreen") }, { view: "tube", label: t("card.goTube") }];
    else if (name.startsWith("console.scope.tube")) list = [{ view: "screen", label: t("card.goScreen") }];
    else if (name.startsWith("console.")) list = [{ view: "console", label: t("card.goConsole") }];
    // a card offers no button for the viewpoint already shown, except the desk's: the desk is
    // the console, so at Console its first action reframes Console, as the menu and Home do
    if (name !== "console.desk") list = list.filter((a) => a.view !== this.view);
    list.push({ look: true, label: t("card.look") });
    return list;
  }

  /**
   * Does a card's action.
   * @param {string} name the part or cable
   * @param {CardAction} a
   */
  act(name, a) {
    if (a.view) this.go(a.view, true, name);
    else this.look(name);
  }

  /**
   * A close look: the camera flies in to frame one part, always from the same place: the first
   * of a fixed list of directions from which nothing hides it (viewer.lookPose). It is a move
   * within the viewpoint, not a viewpoint: no link, no menu entry; Back and
   * Escape return to the viewpoint's framing. The card stays open, with nothing highlighted.
   * @param {string} name
   */
  look(name) {
    const view = this.view3d;
    const o = view?.built.parts.get(name) ?? view?.built.cables.get(name);
    if (!view || !o) return;
    this.openCard(name);
    this.closeLook = name;
    view.select(null);
    this.renderCrumbs();
    // the free area changes (the card is counted); the flight moves the picture there
    view.setFreeForFlight(this.freeRect());
    view.goTo(() => view.lookPose(o));
  }

  /** @param {string | null} name */
  openCard(name) {
    if (!name) {
      this.closeCard();
      return;
    }
    const cable = name.startsWith("cable.");
    const ud = (this.view3d?.built.parts.get(name) ?? this.view3d?.built.cables.get(name))?.userData ?? {};
    const close = el("button", { class: "btn icon-only card-close", type: "button" }, [icon("close")]);
    setTip(close, t("card.close"));
    close.addEventListener("click", () => {
      this.closeCard();
      this.view3d?.select(null);
    });
    const actions = this.cardActions(name).map((a) => {
      const b = el("button", { class: "btn tonal small", type: "button", text: a.label });
      b.addEventListener("click", () => this.act(name, a));
      return b;
    });
    /** @type {(Node | null)[]} */
    const parts = [
      close,
      el("h2", { text: t(cable ? name : `part.${name}`) }),
      el("p", { text: t(cable ? "cable.what" : `part.${name}.what`) }),
      NOT_IN_STRIP.has(name) ? el("p", { text: t("card.notInStrip") }) : null,
      !cable && ud.confidence ? el("p", { class: "confidence", text: t(`confidence.${ud.confidence}`) }) : null,
      actions.length ? el("div", { class: "card-actions" }, actions) : null,
    ];
    this.card.replaceChildren(.../** @type {Node[]} */ (parts.filter(Boolean)));
    this.card.hidden = false;
  }

  closeCard() {
    if (this.card.hidden) return;
    this.card.hidden = true;
  }

  // ---- the Screen's light pen (V3) ----

  wirePen() {
    const canvas = this.screenCrt.canvas;
    let pressed = false;
    /** @param {PointerEvent} e */
    const aim = (e) => {
      const [x, y] = this.screenCrt.toInches(e.clientX, e.clientY);
      this.ops.machine().pen(x, y, pressed);
      if (pressed) this.ops.say(t("status.pen", { x: x.toFixed(2), y: y.toFixed(2) }));
    };
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      pressed = true;
      aim(e);
    });
    canvas.addEventListener("pointermove", aim);
    for (const ev of ["pointerup", "pointercancel"])
      canvas.addEventListener(ev, (e) => {
        pressed = false;
        aim(/** @type {PointerEvent} */ (e));
      });
    canvas.addEventListener("pointerleave", () => this.ops.machine().pen(0, 0, false));
  }

  // ---- the Tube (V4, V5) ----

  wireTube() {
    for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (this.tubeEl.querySelectorAll("[data-scale]"))) {
      b.addEventListener("click", () => {
        const s = Number(b.dataset.scale);
        this.ops.setScale(s);
        this.markTime(s);
      });
    }
    /** @type {HTMLElement} */ (document.getElementById("inset")).addEventListener("click", () => this.go("screen"));
  }

  /** @param {number} scale */
  markTime(scale) {
    for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (this.tubeEl.querySelectorAll("[data-scale]"))) b.setAttribute("aria-pressed", String(Number(b.dataset.scale) === scale));
  }

  // ---- painting ----

  /**
   * Paints what is shown.
   * @param {Agt30} agt
   * @param {number} eyeUs the eye's window (R14)
   * @param {boolean} slow time is slowed: show the spot
   */
  paint(agt, eyeUs, slow) {
    // the 3D view renders until the Screen's 2D surface takes over at the end of the flight (V8)
    if (this.view3d?.active) {
      this.faceCrt.paint(agt.segs, agt.now, eyeUs, { beam: slow });
      this.view3d.update(agt);
    }
    if (!this.screenEl.hidden) this.screenCrt.paint(agt.segs, agt.now, eyeUs, { beam: slow });
    if (this.view === "tube") {
      this.insetCrt.paint(agt.segs, agt.now, eyeUs, { beam: slow });
      this.traces.paint(agt);
    }
  }
}
