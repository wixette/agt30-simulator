// SPDX-License-Identifier: Apache-2.0
//
// The page's components (docs/ui-design.md, P10): icons, texts and tooltips, menus, tabs and
// dialogs. One of each kind, used the same way everywhere, following Material Design 3's
// patterns and WAI-ARIA's keyboard rules. After the Leibniz Stepped Reckoner simulator's
// (https://github.com/wixette/leibniz-stepped-reckoner, Apache-2.0).

import { ICONS } from "../../vendor/material-symbols/icons.js";
import { t } from "../l10n/l10n.js";

/** @typedef {keyof typeof ICONS} IconName */

const SVG = "http://www.w3.org/2000/svg";

/**
 * A Material Symbol as an inline SVG element, in the current text colour.
 * @param {IconName} name
 * @returns {SVGSVGElement}
 */
export function icon(name) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 -960 960 960");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", ICONS[name]);
  svg.appendChild(path);
  return svg;
}

/**
 * An element with attributes and children.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string | boolean | undefined>} [attrs]
 * @param {(Node | string | null | undefined)[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") e.className = String(v);
    else if (k === "text") e.textContent = String(v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c !== null && c !== undefined) e.append(c);
  return e;
}

/**
 * Replace each <i data-icon="name"> placeholder under root with its icon.
 * @param {ParentNode} root
 */
export function applyIcons(root) {
  for (const i of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll("i[data-icon]"))) {
    i.replaceWith(icon(/** @type {IconName} */ (i.dataset.icon)));
  }
}

/**
 * Translate the texts under root: data-l10n sets the text, data-l10n-tip the tooltip and the
 * screen-reader name (an icon button's only name).
 * @param {ParentNode} root
 */
export function applyL10n(root) {
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll("[data-l10n]"))) {
    e.textContent = t(/** @type {string} */ (e.dataset.l10n));
  }
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll("[data-l10n-tip]"))) {
    setTip(e, t(/** @type {string} */ (e.dataset.l10nTip)));
  }
}

// ---- tooltips ---------------------------------------------------------------------------------
/** @type {HTMLElement | null} */
let tipBox = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let tipTimer;

/**
 * Give an element a tooltip (shown on hover and keyboard focus) and a screen-reader name. An
 * element with its own visible label (data-tip-describes: a text button, a labelled field) keeps
 * that label as its name, and the tooltip describes it.
 * @param {HTMLElement} e
 * @param {string} text
 */
export function setTip(e, text) {
  e.dataset.tip = text;
  e.setAttribute(e.hasAttribute("data-tip-describes") ? "aria-description" : "aria-label", text);
  if (e.dataset.tipBound) return;
  e.dataset.tipBound = "1";
  const show = () => {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      // never over an open menu: the tooltip would cover what was just asked for
      if (!e.isConnected || !e.dataset.tip || openMenu) return;
      tipBox ??= document.body.appendChild(el("div", { class: "tooltip", role: "presentation" }));
      tipBox.textContent = e.dataset.tip;
      tipBox.hidden = false;
      const r = e.getBoundingClientRect();
      const b = tipBox.getBoundingClientRect();
      const below = r.bottom + 8 + b.height < window.innerHeight;
      tipBox.style.top = `${below ? r.bottom + 8 : r.top - 8 - b.height}px`;
      tipBox.style.left = `${Math.max(8, Math.min(window.innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2))}px`;
    }, 450);
  };
  const hide = () => {
    clearTimeout(tipTimer);
    if (tipBox) tipBox.hidden = true;
  };
  e.addEventListener("pointerenter", (ev) => ev.pointerType === "mouse" && show());
  e.addEventListener("pointerleave", hide);
  e.addEventListener("focus", () => e.matches(":focus-visible") && show());
  e.addEventListener("blur", hide);
  e.addEventListener("click", hide);
}

// ---- menus ------------------------------------------------------------------------------------
/**
 * @typedef {object} MenuItem
 * @property {string} label
 * @property {() => void} run
 * @property {boolean} [checked] shown with a check (a choice among several)
 * @property {IconName} [icon] shown before the label
 * @property {string | true} [divider] a line before the item, headed by the text if one is given
 */

/** @type {{ box: HTMLElement; anchor: HTMLElement } | null} */
let openMenu = null;

/** Close the open menu, if any. */
export function closeMenu() {
  if (!openMenu) return;
  const { box, anchor } = openMenu;
  openMenu = null;
  box.remove();
  anchor.setAttribute("aria-expanded", "false");
}

/**
 * Open a menu under (or above) an anchor button. Arrow keys move, Enter or Space choose,
 * Escape and a click outside close it.
 * @param {HTMLElement} anchor
 * @param {MenuItem[]} items
 */
export function showMenu(anchor, items) {
  const again = openMenu?.anchor === anchor;
  closeMenu();
  if (again) return;
  const box = el("div", { class: "menu", role: "menu" });
  const buttons = items.map((it) => {
    if (it.divider) box.appendChild(el("div", { class: "menu-divider", role: "separator" }, [typeof it.divider === "string" ? el("span", { text: it.divider }) : null]));
    const role = it.checked === undefined ? "menuitem" : "menuitemradio";
    const mark = it.checked === undefined ? null : it.checked ? icon("check") : el("span", { class: "check" });
    const b = el("button", { role, tabindex: "-1" }, [mark, it.icon ? icon(it.icon) : null, el("span", { text: it.label })]);
    if (it.checked !== undefined) b.setAttribute("aria-checked", String(it.checked));
    b.addEventListener("click", () => {
      closeMenu();
      anchor.focus();
      it.run();
    });
    box.appendChild(b);
    return b;
  });
  document.body.appendChild(box);
  openMenu = { box, anchor };
  if (tipBox) tipBox.hidden = true;
  anchor.setAttribute("aria-expanded", "true");
  const r = anchor.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const below = r.bottom + 4 + b.height <= window.innerHeight - 8;
  box.style.top = `${below ? r.bottom + 4 : Math.max(8, r.top - 4 - b.height)}px`;
  // open towards the middle of the window: from the anchor's left edge, or its right edge on the right
  const left = r.left + r.width / 2 > window.innerWidth / 2 ? r.right - b.width : r.left;
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - b.width - 8, left))}px`;
  const start = Math.max(0, items.findIndex((it) => it.checked));
  buttons[start]?.focus();
  box.addEventListener("keydown", (e) => {
    const i = buttons.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length].focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      buttons[e.key === "Home" ? 0 : buttons.length - 1].focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      closeMenu();
      anchor.focus();
    }
  });
}

document.addEventListener("pointerdown", (e) => {
  if (openMenu && !openMenu.box.contains(/** @type {Node} */ (e.target)) && !openMenu.anchor.contains(/** @type {Node} */ (e.target))) closeMenu();
});
window.addEventListener("resize", closeMenu);

// ---- tabs (WAI-ARIA tabs, automatic activation) -------------------------------------------------
/**
 * @param {HTMLElement} list the role="tablist" element
 * @param {(id: string) => void} onSelect called with the selected tab's id
 * @returns {(id: string) => void} selects a tab by id
 */
export function tabs(list, onSelect) {
  const all = /** @type {HTMLButtonElement[]} */ ([...list.querySelectorAll('[role="tab"]')]);
  /** @param {string} id */
  const select = (id) => {
    for (const tab of all) {
      const on = tab.id === id;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(/** @type {string} */ (tab.getAttribute("aria-controls")));
      if (panel) panel.hidden = !on;
    }
    onSelect(id);
  };
  for (const tab of all) tab.addEventListener("click", () => select(tab.id));
  list.addEventListener("keydown", (e) => {
    const i = all.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (i < 0) return;
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % all.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + all.length) % all.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = all.length - 1;
    if (j < 0) return;
    e.preventDefault();
    all[j].focus();
    select(all[j].id);
  });
  return select;
}

// ---- dialogs (Material 3, on the native <dialog>) ------------------------------------------------
/**
 * Opens a modal dialog with a title band and a body; Escape, the close button or a click on the
 * scrim closes it, and the focus goes back where it was.
 * @param {string} title
 * @param {Node[]} body
 * @returns {HTMLDialogElement}
 */
export function showDialog(title, body) {
  const close = el("button", { class: "btn icon-only", type: "button" }, [icon("close")]);
  setTip(close, t("card.close"));
  const d = el("dialog", { class: "dialog", "aria-label": title }, [
    el("div", { class: "dialog-head" }, [el("h2", { text: title }), close]),
    el("div", { class: "dialog-body" }, body),
  ]);
  close.addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener("close", () => d.remove());
  document.body.appendChild(d);
  d.showModal();
  return d;
}

/** @returns {boolean} whether a dialog or a menu is open over the page */
export const overlayOpen = () => openMenu !== null || document.querySelector("dialog[open]") !== null;
