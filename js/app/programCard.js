// SPDX-License-Identifier: Apache-2.0
//
// The program card, the dock's Program tab (docs/ui-design.md, U7): the program's title and
// what it rebuilds, how to use it, its actions (each types a statement, U8), what is ours, the
// statements, and the ADEPT source, folded.

import { el } from "../ui/components.js";
import { t } from "../l10n/l10n.js";

/** @typedef {import("../sim/programs.js").Program} Program */

/**
 * Draws the card.
 * @param {HTMLElement} host
 * @param {Program | null} p
 * @param {Record<string, string>} sources the ADEPT files, by name
 * @param {{ type: (statement: string, label: string) => void; busy: boolean }} ops
 */
export function renderProgramCard(host, p, sources, ops) {
  if (!p) {
    host.replaceChildren(el("div", { class: "program-card" }, [el("p", { class: "empty", text: t("program.none") })]));
    return;
  }
  const title = t(`program.${p.id}.title`);
  // a switch per setting: it types the statement for the other state; its state is the machine's
  const toggles = p.toggles.map((g) => {
    const label = t(`program.toggle.${g.id}`);
    const sw = el("button", { class: "switch", type: "button", role: "switch", "aria-checked": "false", "data-toggle": g.id }, [el("span", { class: "switch-track" }, [el("span", { class: "switch-thumb" })]), el("span", { text: label })]);
    sw.addEventListener("click", () => {
      const on = sw.getAttribute("aria-checked") === "true";
      ops.type(on ? g.off : g.on, t(on ? "program.toggle.off" : "program.toggle.on", { label }));
    });
    return sw;
  });
  const actions = p.actions.map((a) => {
    const b = el("button", { class: "btn tonal small", type: "button", text: t(`program.action.${a.id}`), "aria-disabled": String(ops.busy) });
    b.addEventListener("click", () => ops.type(a.type, t(`program.action.${a.id}`)));
    return b;
  });
  const ours = el(
    "ul",
    {},
    p.reconstructions.map((id) => el("li", {}, [el("strong", { text: id }), ` ${t(`recon.${id}`)}`])),
  );
  const statements = p.statements.join("\n").replace(/\r/g, "");
  const files = p.files.map((f) =>
    el("details", {}, [el("summary", { text: t("program.source", { file: `${f}.adept` }) }), el("pre", { text: sources[f] ?? "" })]),
  );
  host.replaceChildren(
    el("div", { class: "program-card" }, [
      el("h2", { text: title }),
      el("p", { class: "rebuilds", text: t("program.rebuilds", { source: p.source }) }),
      el("p", { text: t(`program.${p.id}.what`) }),
      el("h3", { text: t("program.use") }),
      el("p", { text: t(`program.${p.id}.use`) }),
      actions.length || toggles.length ? el("h3", { text: t("program.actions") }) : null,
      actions.length || toggles.length ? el("div", { class: "actions" }, [...toggles, ...actions]) : null,
      el("h3", { text: t("program.ours") }),
      ours,
      el("h3", { text: t("program.statements") }),
      el("pre", { text: statements }),
      ...files,
    ]),
  );
}

/**
 * Shows the machine's own state on the card's switches (it may have changed by a statement typed
 * on the Teletype).
 * @param {HTMLElement} host
 * @param {import("../sim/agt.js").Agt30} agt
 */
export function syncSwitches(host, agt) {
  for (const sw of /** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll("[data-toggle]"))) {
    const on = sw.dataset.toggle === "depth" ? agt.dsply.view.dim !== 0 : false;
    if (sw.getAttribute("aria-checked") !== String(on)) sw.setAttribute("aria-checked", String(on));
  }
}
