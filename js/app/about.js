// SPDX-License-Identifier: Apache-2.0
//
// About (docs/ui-design.md, U14): what the simulator is and its version; where the list of what it
// reconstructs is (the README); credits; the licenses; the source. As the series' About, its foot
// has References, which opens the References tab, and Close.

import { el, showDialog } from "../ui/components.js";
import { t } from "../l10n/l10n.js";
import { SOURCE_URL } from "./aboutData.js";

/**
 * Opens About.
 * @param {string} version
 * @param {() => void} references opens the References tab
 */
export function openAbout(version, references) {
  const logo = el("img", { src: new URL("../../images/logo.svg", import.meta.url).href, alt: "" });
  showDialog(t("about.title"), [
    el("div", { class: "about-band" }, [logo, el("div", {}, [el("strong", { text: t("app.name") }), el("div", { class: "version", text: t("about.version", { version }) })])]),
    el("p", { text: t("about.what") }),
    el("p", {}, [t("about.recon"), " ", el("a", { href: `${SOURCE_URL}#what-is-reconstructed`, target: "_blank", rel: "noopener", text: t("about.recon.link") })]),
    el("h3", { text: t("about.credits") }),
    el("p", { text: t("about.credits.sources") }),
    el("p", { text: t("about.credits.libs") }),
    el("h3", { text: t("about.licenses") }),
    el(
      "ul",
      {},
      ["code", "content", "three", "font", "icons"].map((k) => el("li", { text: t(`about.license.${k}`) })),
    ),
    el("p", {}, [el("a", { href: SOURCE_URL, target: "_blank", rel: "noopener", text: t("about.source") })]),
  ], [
    { label: t("about.references"), run: references },
    { label: t("about.close"), primary: true },
  ]);
}
