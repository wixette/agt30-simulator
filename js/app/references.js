// SPDX-License-Identifier: Apache-2.0
//
// The References tab (docs/ui-design.md, U16), as the series' (the TRS-80 simulator's): one column
// down the middle of the dock, looked up rather than read in order; the history first, then
// Adage's documents, NCSU's tapes, and the simulator's source and research. About's References
// button opens it. The addresses are in aboutData.js.

import { t } from "../l10n/l10n.js";
import { el } from "../ui/components.js";
import { REFERENCES } from "./aboutData.js";

/** Fills the References pane. @param {HTMLElement} host */
export function buildReferences(host) {
  host.replaceChildren(
    el(
      "article",
      { class: "references" },
      REFERENCES.flatMap(([group, items]) => [
        el("h3", { text: t(`refs.${group}`) }),
        el(
          "ul",
          { class: "link-list" },
          items.map(([id, href]) => el("li", {}, [el("a", { href, target: "_blank", rel: "noopener", text: t(`refs.${group}.${id}`) })])),
        ),
      ]),
    ),
  );
}
