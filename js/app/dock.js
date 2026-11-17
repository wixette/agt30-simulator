// SPDX-License-Identifier: Apache-2.0
//
// The dock under the stage (docs/ui-design.md, U1): three tools, Program, Teletype and Processor,
// one at a time. It is resized by its top edge (drag, or the arrow keys on the handle), folds to its tab
// bar, and marks a tab with a dot when something new happens on it out of sight. The stage keeps
// at least 320 px.

import { icon, setTip, tabs } from "../ui/components.js";
import { t } from "../l10n/l10n.js";

/** The stage's least height, px (U1). */
const STAGE_MIN = 320;
/** The dock's least open height, px. */
const DOCK_MIN = 120;
/** Its height at start: this share of the window, so the Teletype shows a dozen lines or more, and never less than DOCK_START_MIN px. */
const DOCK_START_SHARE = 0.36;
const DOCK_START_MIN = 210;
/** One arrow key's step on the handle, px. */
const KEY_STEP = 24;

/** @typedef {"program" | "tty" | "proc"} Tool */
/** The tabs' element ids, by tool. */
const TAB_IDS = { program: "tab-program", tty: "tab-tty", proc: "tab-proc" };

/**
 * @typedef {object} Dock
 * @property {(id: Tool) => void} show selects a tab and opens the dock
 * @property {(id: Tool) => void} mark puts a dot on a tab not in view
 * @property {() => boolean} ttyShown whether the Teletype is in view
 * @property {() => boolean} procShown whether the Processor is in view
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
  let height = Math.max(DOCK_START_MIN, Math.round(window.innerHeight * DOCK_START_SHARE));
  let folded = false;
  /** @type {Tool} */
  let current = "program";

  const apply = () => {
    const max = window.innerHeight - 56 - 30 - STAGE_MIN;
    height = Math.max(DOCK_MIN, Math.min(max, height));
    dock.classList.toggle("folded", folded);
    dock.style.height = folded ? "" : `${height}px`;
    fold.replaceChildren(icon(folded ? "keyboard_arrow_up" : "keyboard_arrow_down"));
    setTip(fold, t(folded ? "dock.unfold" : "dock.fold"));
    handle.setAttribute("aria-valuenow", String(folded ? 0 : height));
    onResize();
  };

  const select = tabs(/** @type {HTMLElement} */ (document.getElementById("dock-tabs")), (id) => {
    current = /** @type {Tool} */ (Object.keys(TAB_IDS).find((k) => TAB_IDS[/** @type {Tool} */ (k)] === id) ?? "program");
    const tab = document.getElementById(id);
    tab?.querySelector(".dot")?.setAttribute("hidden", "");
    if (folded) {
      folded = false;
      apply();
    }
    if (current === "tty") {
      // the paper printed while hidden could not scroll: show its latest line
      const paper = document.getElementById("tty-paper");
      if (paper) {
        paper.scrollTop = paper.scrollHeight;
        paper.focus({ preventScroll: true });
      }
    }
    onShow(current);
  });

  fold.addEventListener("click", () => {
    folded = !folded;
    apply();
  });
  handle.addEventListener("pointerdown", (e) => {
    handle.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const h0 = folded ? DOCK_MIN : height;
    folded = false;
    /** @param {PointerEvent} m */
    const move = (m) => {
      height = h0 + (y0 - m.clientY);
      apply();
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
  handle.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
    if (!d) return;
    e.preventDefault();
    folded = false;
    height += d;
    apply();
  });
  window.addEventListener("resize", apply);
  select("tab-program");
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
    isFolded: () => folded,
  };
}
