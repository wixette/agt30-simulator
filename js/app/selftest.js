// SPDX-License-Identifier: Apache-2.0
//
// ?selftest (docs/development.md): runs the acceptance checks in the page, the same list the
// Node tests run (js/accept/), shows a tick or a cross for each, and publishes the result as
// window.__selftest = { done, passed, failed } for scripted runs.

import { CRT_CHECKS } from "../accept/crt.js";
import { MODEL_CHECKS } from "../accept/model.js";
import { SCENE_CHECKS } from "../accept/scene.js";
import { el } from "../ui/components.js";
import { t } from "../l10n/l10n.js";

/** @returns {boolean} */
export const selftestRequested = () => new URLSearchParams(location.search).has("selftest");

/**
 * Runs the checks, one per animation frame so the page stays alive.
 * @param {import("../accept/check.js").Context} ctx
 * @param {import("../accept/check.js").Check[]} [extra] the page's own checks
 */
export async function runSelftest(ctx, extra = []) {
  const state = { done: false, passed: 0, failed: 0 };
  /** @type {any} */ (window).__selftest = state;
  const list = el("ul");
  const panel = el("div", { class: "selftest", role: "region", "aria-label": t("selftest.title") }, [el("strong", { text: t("selftest.title") }), el("p", { text: t("selftest.running") }), list]);
  document.body.append(panel);
  for (const c of [...MODEL_CHECKS, ...CRT_CHECKS, ...SCENE_CHECKS, ...extra]) {
    await new Promise((r) => requestAnimationFrame(r));
    try {
      c.run(ctx);
      state.passed++;
      list.append(el("li", { class: "pass", text: `✓ ${c.id}: ${c.title}` }));
    } catch (e) {
      state.failed++;
      list.append(el("li", { class: "fail", text: `✗ ${c.id}: ${c.title}: ${/** @type {Error} */ (e).message}` }));
    }
  }
  /** @type {HTMLElement} */ (panel.querySelector("p")).textContent = t("selftest.done", { passed: state.passed, failed: state.failed });
  state.done = true;
}
