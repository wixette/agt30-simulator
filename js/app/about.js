// SPDX-License-Identifier: Apache-2.0
//
// About (docs/ui-design.md, U14): what the simulator is and its version; what is reconstructed,
// the short form of each entry of design/reconstructions.md; credits; the licences; the source.

import { el, showDialog } from "../ui/components.js";
import { t } from "../l10n/l10n.js";
import { RECONSTRUCTIONS, SOURCE_URL } from "./aboutData.js";


/**
 * Opens About, scrolled to a reconstruction if one is named.
 * @param {string} version
 * @param {string} [recon] e.g. "R4"
 */
export function openAbout(version, recon) {
  const logo = el("img", { src: new URL("../../images/logo.svg", import.meta.url).href, alt: "" });
  const d = showDialog(t("about.title"), [
    el("div", { class: "about-band" }, [logo, el("div", {}, [el("strong", { text: t("app.name") }), el("div", { class: "version", text: t("about.version", { version }) })])]),
    el("p", { text: t("about.what") }),
    el("h3", { text: t("about.recon") }),
    el("p", { text: t("about.recon.intro") }),
    el(
      "ul",
      { class: "recon" },
      RECONSTRUCTIONS.map((id) => el("li", { id: `about-${id}` }, [el("strong", { text: `${id}. ` }), t(`recon.${id}`)])),
    ),
    el("h3", { text: t("about.credits") }),
    el("p", { text: t("about.credits.sources") }),
    el("p", { text: t("about.credits.libs") }),
    el("h3", { text: t("about.licences") }),
    el(
      "ul",
      {},
      ["code", "content", "three", "font", "icons"].map((k) => el("li", { text: t(`about.licence.${k}`) })),
    ),
    el("p", {}, [el("a", { href: SOURCE_URL, target: "_blank", rel: "noopener", text: t("about.source") })]),
  ]);
  if (recon) d.querySelector(`#about-${recon}`)?.scrollIntoView({ block: "center" });
}
