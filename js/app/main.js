// SPDX-License-Identifier: Apache-2.0
//
// The page's entry point: it reads the programs, boots the AGT-30, builds the top bar, the
// stage, the console strip, the dock and the status line, and runs the main loop. Every view
// reads the one machine (D1); Reset replaces it with a new one, powered on afresh (U3).

import params from "../../params/terminal.json" with { type: "json" };
import pkg from "../../package.json" with { type: "json" };
import { Agt30, FAST_US_PER_CHAR } from "../sim/agt.js";
import { tickUs } from "../sim/frameclock.js";
import { readPrograms } from "../sim/programs.js";
import { applyIcons, applyL10n, showMenu } from "../ui/components.js";
import { num, t } from "../l10n/l10n.js";
import { eyeWindowUs } from "../view/phosphor.js";
import { openAbout } from "./about.js";
import { buildDock } from "./dock.js";
import { formatLink, parseLink } from "./link.js";
import { renderProgramCard, syncSwitches } from "./programCard.js";
import { Runner } from "./runner.js";
import { selftestRequested, runSelftest } from "./selftest.js";
import { Stage } from "./stage.js";
import { buildStrip } from "./strip.js";
import { buildTeletype } from "./teletype.js";

/** @typedef {import("../sim/programs.js").Program} Program */
/** @typedef {import("./link.js").View} View */

const query = new URLSearchParams(location.search);
const status = /** @type {HTMLElement} */ (document.getElementById("status-text"));
const fpsEl = /** @type {HTMLElement} */ (document.getElementById("fps"));
/** @param {string} msg */
const say = (msg) => (status.textContent = msg);

applyIcons(document);
applyL10n(document);

// the programs, from programs/ beside this page, with this release's version in their names
const version = new URL(import.meta.url).searchParams.get("v");
/** @param {string} name */
const read = async (name) => {
  const url = new URL(`../../programs/${name}`, import.meta.url);
  url.search = version ? `?v=${version}` : "";
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.text();
};

try {
  await start();
} catch (e) {
  say(t("app.loadFailed", { error: /** @type {Error} */ (e).message }));
  throw e;
}

async function start() {
  const { manifest, sources } = await readPrograms(read);
  let agt = Agt30.boot(sources);
  const machine = () => agt;
  if (query.has("debug")) Object.defineProperty(window, "agt", { get: machine });

  /** @type {Program | null} */
  let program = null;
  let wasBusy = false;
  /** @type {View} */
  let view = "room";

  const runner = new Runner(machine);
  const strip = buildStrip(/** @type {HTMLElement} */ (document.getElementById("strip")), machine, say);
  const stage = new Stage(/** @type {any} */ (params), {
    machine,
    say,
    onView: (v) => {
      view = v;
      writeLink();
    },
    setScale: (s) => (runner.scale = s),
    setPen: (on) => strip.setPen(on),
  }, query.get("phosphor"));
  if (query.has("debug")) Object.defineProperty(window, "stage", { value: stage });
  const dock = buildDock(() => stage.refit());
  const tty = buildTeletype(machine, () => {
    if (!dock.ttyShown()) dock.mark("tty");
  });

  const programCard = /** @type {HTMLElement} */ (document.getElementById("pane-program"));
  // the Programs button names the program loaded, in every viewpoint, as the viewpoint menu
  // names the viewpoint; with none loaded it says Programs
  const programsLabel = /** @type {HTMLElement} */ (document.getElementById("programs-label"));
  const programsBtn = /** @type {HTMLElement} */ (document.getElementById("programs"));
  const nameProgram = () => {
    const title = program ? t(`program.${program.id}.title`) : null;
    programsLabel.textContent = title ?? t("bar.programs");
    programsBtn.setAttribute("aria-label", title ? t("bar.programs.loaded", { title }) : t("bar.programs"));
  };
  const drawCard = () => {
    nameProgram();
    renderProgramCard(programCard, program, sources, {
      busy: agt.typing,
      programs: manifest.programs,
      load: (p) => load(p),
      type: (statement, label) => {
        agt.type(statement, FAST_US_PER_CHAR);
        say(t("status.action", { statement: label }));
      },
    });
  };
  drawCard();

  const writeLink = () => history.replaceState(null, "", `${location.pathname}${location.search}${formatLink({ view, program: program?.id })}`);

  /**
   * Loads a program as the Programs menu does: types its statements (U8). Typing still under
   * way is stopped first.
   * @param {Program} p
   */
  const load = (p) => {
    agt.cancelTyping();
    program = p;
    agt.type(p.statements.join(""), FAST_US_PER_CHAR);
    drawCard();
    // the reader's choice of tab stands: a folded dock opens on the new card, an open one stays
    // where it is, and the tab not in view gets its dot
    if (dock.isFolded()) dock.show("program");
    dock.mark("program");
    dock.mark("tty");
    writeLink();
    say(t("status.typing", { title: t(`program.${p.id}.title`) }));
  };

  // ---- the top bar (U3) ----
  programsBtn.addEventListener("click", () =>
    showMenu(
      programsBtn,
      manifest.programs.map((p) => ({ label: t(`program.${p.id}.title`), run: () => load(p) })),
    ),
  );
  /** @type {HTMLElement} */ (document.getElementById("reset")).addEventListener("click", () => {
    agt = Agt30.boot(sources);
    program = null;
    drawCard();
    tty.render();
    writeLink();
    say(t("status.reset"));
  });
  /** @type {HTMLElement} */ (document.getElementById("about")).addEventListener("click", () => openAbout(pkg.version));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || document.querySelector("dialog[open], .menu")) return;
    if (document.activeElement?.id === "tty-paper") return;
    stage.up();
  });

  // ---- the main loop ----
  runner.listeners.push(() => {
    const period = tickUs(agt.rate);
    stage.paint(agt, eyeWindowUs(period, runner.scale), runner.scale < 0.05);
    strip.update();
    syncSwitches(programCard, agt);
    tty.render();
    if (agt.typing !== wasBusy) {
      wasBusy = agt.typing;
      drawCard();
      if (!wasBusy && program) say(t("status.loaded", { title: t(`program.${program.id}.title`) }));
    }
    fpsEl.textContent = agt.image === null ? t("status.halted") : runner.scale < 1 ? t("status.slowed", { rate: agt.rate }) : t("status.fps", { fps: num(Math.round(agt.stats().fps)), rate: agt.rate });
  });

  // ---- the link (U13): a viewpoint and a program ----
  const link = parseLink(location.hash, manifest.programs.map((p) => p.id));
  say(t("status.ready"));
  runner.start();
  stage.go("room", false);
  if (link.view && link.view !== "room") stage.go(link.view);
  const linked = manifest.programs.find((p) => p.id === link.program);
  if (linked) load(linked);

  if (selftestRequested()) runSelftest({ boot: () => Agt30.boot(sources), manifest, sources });
}
