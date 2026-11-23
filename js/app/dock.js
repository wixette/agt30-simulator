// SPDX-License-Identifier: Apache-2.0
//
// The dock under the stage (docs/ui-design.md, U1): five tools, Program, Teletype, Processor,
// Panel and References, one at a time. It is resized by the handle above it (drag, or the arrow keys on the handle),
// folds to its tab bar, remembers its tab, height and fold, and marks a tab with a dot when
// something new happens on it out of sight. The stage keeps its least height: 320 px on a desktop,
// more of a phone's. As the simulator series' dock (the TRS-80 simulator's).

import { icon, setTip, tabs } from "../ui/components.js";
import { t } from "../l10n/l10n.js";

/** @typedef {"program" | "tty" | "proc" | "panel" | "refs"} Tool */
/** The tabs' element ids, by tool. */
const TAB_IDS = { program: "tab-program", tty: "tab-tty", proc: "tab-proc", panel: "tab-panel", refs: "tab-refs" };

/** The dock's least open height, px. */
const DOCK_MIN = 120;
/** A window this short, px, or shorter (a phone on its side): the dock opens folded at first. */
const SHORT = 520;
/** A window this narrow, px, or narrower: a phone, upright. */
const NARROW = 700;
/** The share of the window the dock takes until the reader chooses its height. */
const DOCK_START = 0.3;
/** One arrow key's step on the handle, px. */
const KEY_STEP = 24;
const STORE = "agt30.dock";

/** The stage's least height in this window, px (U1): 320 on a desktop; on a phone, more of it. */
export function stageMin() {
  const h = window.innerHeight;
  if (h <= SHORT) return Math.round(h * 0.65);
  if (window.innerWidth <= NARROW) return Math.round(h * 0.55);
  return 320;
}
/** The dock's least open height in this window, px. */
const dockMin = () => Math.min(DOCK_MIN, Math.round(window.innerHeight * 0.25));

/** @returns {{ tab?: Tool, height?: number, folded?: boolean }} */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * @typedef {object} Dock
 * @property {(id: Tool) => void} show selects a tab and opens the dock
 * @property {(id: Tool) => void} mark puts a dot on a tab not in view
 * @property {() => boolean} ttyShown whether the Teletype is in view
 * @property {() => boolean} procShown whether the Processor is in view
 * @property {() => boolean} panelShown whether the Panel is in view
 * @property {() => boolean} isFolded whether the dock is folded to its tab bar
 */

/**
 * @param {() => void} onResize called when the stage's size changes
 * @param {(id: Tool) => void} [onShow] called when a tab is selected
 * @returns {Dock}
 */
export function buildDock(onResize, onShow = () => {}) {
  const dock = /** @type {HTMLElement} */ (document.getElementById("dock"));
  const handle = /** @type {HTMLElement} */ (document.getElementById("dock-handle"));
  const fold = /** @type {HTMLButtonElement} */ (document.getElementById("dock-fold"));
  const saved = load();
  /**
   * The height the reader chose with the handle, px, or null: until they do, the dock takes
   * DOCK_START of the window. A window too small squeezes the dock but never changes what was
   * chosen, so the dock comes back as the window does (and after a reload).
   * @type {number | null}
   */
  let wanted = typeof saved.height === "number" ? saved.height : null;
  let height = 0;
  let folded = saved.folded ?? window.innerHeight <= SHORT;
  /** @type {Tool} */
  let current = saved.tab && saved.tab in TAB_IDS ? saved.tab : "program";
  let starting = true;

  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ tab: current, height: wanted === null ? undefined : Math.round(wanted), folded }));
    } catch {
      // private browsing: the dock is not remembered
    }
  };

  /** The tallest the dock may be in this window: whatever leaves the stage its least, px. */
  const maxHeight = () => {
    const h = (/** @type {string} */ id) => document.getElementById(id)?.offsetHeight ?? 0;
    return Math.max(dockMin(), document.body.clientHeight - h("topbar") - h("status") - h("dock-handle") - stageMin());
  };

  const apply = () => {
    height = Math.max(dockMin(), Math.min(maxHeight(), wanted ?? Math.round(window.innerHeight * DOCK_START)));
    dock.classList.toggle("folded", folded);
    dock.style.height = folded ? "" : `${height}px`;
    fold.replaceChildren(icon(folded ? "keyboard_arrow_up" : "keyboard_arrow_down"));
    setTip(fold, t(folded ? "dock.unfold" : "dock.fold"));
    handle.setAttribute("aria-valuenow", String(folded ? 0 : height));
    save();
    onResize();
  };

  /** The reader's height, by the handle: what the window allows of it is what they chose. @param {number} h */
  const choose = (h) => {
    wanted = h;
    apply();
    wanted = height;
    save();
  };

  const select = tabs(/** @type {HTMLElement} */ (document.getElementById("dock-tabs")), (id) => {
    current = /** @type {Tool} */ (Object.keys(TAB_IDS).find((k) => TAB_IDS[/** @type {Tool} */ (k)] === id) ?? "program");
    const tab = document.getElementById(id);
    tab?.querySelector(".dot")?.setAttribute("hidden", "");
    // a tab chosen opens the dock; the one shown at the start leaves it as it was
    if (folded && !starting) {
      folded = false;
      apply();
    }
    save();
    if (current === "tty") {
      // the paper printed while hidden could not scroll: show its latest line
      const paper = document.getElementById("tty-paper");
      if (paper) {
        paper.scrollTop = paper.scrollHeight;
        if (!starting) paper.focus({ preventScroll: true });
      }
    }
    onShow(current);
  });

  fold.addEventListener("click", () => {
    folded = !folded;
    apply();
  });
  handle.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    // the dock's foot stays where it is: its height is from there to the pointer
    const bottom = dock.getBoundingClientRect().bottom;
    /** @param {PointerEvent} m */
    const move = (m) => {
      folded = false;
      choose(bottom - m.clientY);
    };
    const up = () => {
      handle.classList.remove("dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
  handle.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
    if (!d) return;
    e.preventDefault();
    folded = false;
    choose(height + d);
  });
  window.addEventListener("resize", apply);
  select(TAB_IDS[current]);
  starting = false;
  apply();

  return {
    show(id) {
      select(TAB_IDS[id]);
    },
    mark(id) {
      if (current === id && !folded) return;
      const dot = document.getElementById(TAB_IDS[id])?.querySelector(".dot");
      dot?.removeAttribute("hidden");
      dot?.setAttribute("aria-label", t("dock.activity"));
    },
    ttyShown: () => current === "tty" && !folded,
    procShown: () => current === "proc" && !folded,
    panelShown: () => current === "panel" && !folded,
    isFolded: () => folded,
  };
}
