// SPDX-License-Identifier: Apache-2.0
//
// The page's entry point: it reads the programs, boots the AGT-30, builds the top bar, the
// stage, the console strip, the dock and the status line, and runs the main loop. Every view
// reads the one machine (D1); Reset replaces it with a new one, powered on afresh (U3).

import params from "../../params/terminal.json" with { type: "json" };
import pkg from "../../package.json" with { type: "json" };
import { readPack } from "../sim/bare.js";
import { PACK_URL } from "./aboutData.js";
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
import { buildPanel } from "./panel.js";
import { buildProcessor } from "./processor.js";
import { buildReferences } from "./references.js";
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
  /** @type {{ render: (force?: boolean) => void } | null} */
  let proc = null;
  /** @type {{ render: (force?: boolean) => void } | null} */
  let panel = null;
  buildReferences(/** @type {HTMLElement} */ (document.getElementById("pane-refs")));
  const dock = buildDock(() => stage.refit(), (id) => {
    if (id === "proc") proc?.render(true);
    if (id === "panel") panel?.render(true);
  });
  const tty = buildTeletype(machine, () => {
    if (!dock.ttyShown()) dock.mark("tty");
  });
  proc = buildProcessor(machine, say, () => dock.procShown());
  // ---- the real monitor (U19): NCSU's system pack, fetched once, when asked for ----
  /** @type {Promise<Uint32Array> | null} */
  let pack = null;
  /** @param {import("../sim/bare.js").GameId} [game] a game to start once booted */
  const bootPack = async (game) => {
    try {
      if (!pack) {
        say(t("status.pack.fetching"));
        pack = fetch(PACK_URL).then(async (r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return readPack(await r.arrayBuffer());
        });
      }
      const words = await pack;
      if (!game) {
        program = null;
        drawCard();
      }
      if (game) agt.startGame(game, words);
      else agt.bootPack(words);
      proc?.render(true);
      panel?.render(true);
      stage.go("screen");
      say(game ? t(`status.game.${game}`) : t("status.pack.booted"));
    } catch (e) {
      pack = null;
      say(t("status.pack.failed", { error: /** @type {Error} */ (e).message }));
    }
  };
  panel = buildPanel(/** @type {HTMLElement} */ (document.getElementById("pane-panel")), machine, say, () => dock.panelShown(), () => void bootPack());

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
      unload: () => reboot(),
      type: (statement, label) => {
        agt.type(statement, FAST_US_PER_CHAR);
        say(t("status.action", { statement: label }));
      },
    });
  };
  drawCard();

  // the address bar keeps the viewpoint only: a link copied from it opens the app as it starts,
  // not in whatever program was tried last; #program= is still read, for links made on purpose (U13)
  const writeLink = () => history.replaceState(null, "", `${location.pathname}${location.search}${formatLink({ view })}`);

  /**
   * Loads a program as the Programs menu does: types its statements (U8). Typing still under
   * way is stopped first.
   * @param {Program} p
   */
  const load = (p) => {
    if (p.game) {
      // one of NCSU's games: the pack fetched if need be, AMRMX booted, the game started (U19)
      agt.cancelTyping();
      program = p;
      drawCard();
      if (dock.isFolded()) dock.show("program");
      dock.mark("program");
      writeLink();
      void bootPack(p.game);
      return;
    }
    // the programs are the simulator's monitor's: back to it from the real one
    if (agt.bare) reboot();
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
  /**
   * Reboots the terminal: core as at start, the display dark, the paper torn off, no program
   * loaded. Unloading a program is this (U17): the machine had no other way to forget one.
   */
  const reboot = () => {
    const was = program;
    agt = Agt30.boot(sources);
    program = null;
    drawCard();
    tty.render();
    proc?.render(true);
    panel?.render(true);
    writeLink();
    say(was ? t("status.unloaded", { title: t(`program.${was.id}.title`) }) : t("status.reset"));
  };
  // the menu ticks the program loaded; with one loaded, Unload follows, the way back (U17)
  programsBtn.addEventListener("click", () =>
    showMenu(programsBtn, [
      ...manifest.programs.map((p) => ({ label: t(`program.${p.id}.title`), checked: p === program, run: () => load(p) })),
      ...(program ? [{ label: t("bar.programs.unload"), icon: /** @type {const} */ ("eject"), divider: /** @type {const} */ (true), run: reboot }] : []),
    ]),
  );
  /** @type {HTMLElement} */ (document.getElementById("reset")).addEventListener("click", reboot);
  /** @type {HTMLElement} */ (document.getElementById("about")).addEventListener("click", () => openAbout(pkg.version, () => dock.show("refs")));
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
    proc?.render();
    panel?.render();
    if (agt.typing !== wasBusy) {
      wasBusy = agt.typing;
      drawCard();
      if (!wasBusy && program) say(t("status.loaded", { title: t(`program.${program.id}.title`) }));
    }
    const p = agt.panel;
    fpsEl.textContent = !p.power ? t("status.powerOff") : !p.running ? t(`status.cpu.${p.mode}`) : agt.bare ? t("status.amrmx") : agt.image === null ? t("status.halted") : runner.scale < 1 ? t("status.slowed", { rate: agt.rate }) : t("status.fps", { fps: num(Math.round(agt.stats().fps)), rate: agt.rate });
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
