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
 * @param {{ type: (statement: string, label: string) => void; busy: boolean; openRecon: (id: string) => void }} ops
 */
export function renderProgramCard(host, p, sources, ops) {
  if (!p) {
    host.replaceChildren(el("div", { class: "program-card" }, [el("p", { class: "empty", text: t("program.none") })]));
    return;
  }
  const title = t(`program.${p.id}.title`);
  const actions = p.actions.map((a) => {
    const b = el("button", { class: "btn tonal small", type: "button", text: t(`program.action.${a.id}`), "aria-disabled": String(ops.busy) });
    b.addEventListener("click", () => ops.type(a.type, t(`program.action.${a.id}`)));
    return b;
  });
  const ours = el(
    "ul",
    {},
    p.reconstructions.map((id) => {
      const a = el("a", { href: `#about-${id}`, text: id });
      a.addEventListener("click", (e) => {
        e.preventDefault();
        ops.openRecon(id);
      });
      return el("li", {}, [a, ` ${t(`recon.${id}`)}`]);
    }),
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
      actions.length ? el("h3", { text: t("program.actions") }) : null,
      actions.length ? el("div", { class: "actions" }, actions) : null,
      el("h3", { text: t("program.ours") }),
      ours,
      el("h3", { text: t("program.statements") }),
      el("pre", { text: statements }),
      ...files,
    ]),
  );
}
