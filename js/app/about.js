// SPDX-License-Identifier: Apache-2.0
//
// About (docs/ui-design.md, U14): what the simulator is and its version; where the list of what it
// reconstructs is (the README); credits; the licences; the source.

import { el, showDialog } from "../ui/components.js";
import { t } from "../l10n/l10n.js";
import { SOURCE_URL } from "./aboutData.js";


/**
 * Opens About.
 * @param {string} version
 */
export function openAbout(version) {
  const logo = el("img", { src: new URL("../../images/logo.svg", import.meta.url).href, alt: "" });
  showDialog(t("about.title"), [
    el("div", { class: "about-band" }, [logo, el("div", {}, [el("strong", { text: t("app.name") }), el("div", { class: "version", text: t("about.version", { version }) })])]),
    el("p", { text: t("about.what") }),
    el("p", {}, [t("about.recon"), " ", el("a", { href: `${SOURCE_URL}#what-is-reconstructed`, target: "_blank", rel: "noopener", text: t("about.recon.link") })]),
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
}
