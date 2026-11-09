// SPDX-License-Identifier: Apache-2.0
//
// The release screenshots, `pnpm shots`: the README's pictures and a set for posts.
//
//     pnpm shots                     (into ~/Downloads/agt30-v<version>-media/shots/)
//     pnpm shots --out ~/Pictures/x  (elsewhere)
//     pnpm shots --only tube         (the shots whose name contains "tube")
//     pnpm shots --readme            (also write the README's pictures, images/readme/*.jpg)
//
// It drives headless Chrome at 1600 x 900 (tools/headless.mjs) and writes JPEGs. Each shot loads
// the page afresh with a link (#view=...&program=...), sets the dials, and waits. Release media
// are never kept in the repository; the README's three pictures are the exception, committed.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { mediaDir, openBrowser, ROOT, sleep } from "./headless.mjs";

const WIDTH = 1600;
const HEIGHT = 900;
const QUALITY = 90;

/**
 * A shot: its file name, the link it loads, the dials (0-2) it sets, JavaScript run in the page
 * once it has loaded (awaited), how long to wait then, JavaScript awaited just before it is taken
 * (a scene that must be caught: the beam drawing), and, for the README's pictures, its file there.
 * @typedef {{ name: string; hash: string; dials?: number[]; setup?: string; wait?: number; ready?: string; readme?: string }} Shot
 */

/** Plays tic-tac-toe on the bottom layer with the light pen: X, O, X, O, in these cells. */
const PLAY = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const k of [0, 4, 8, 2]) {
    const addr = agt.core.addr("T" + k.toString(8).padStart(2, "0"));
    const s = [...agt.segs].reverse().find((g) => g.item === addr && g.vis);
    if (!s) continue;
    agt.pen((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, true);
    await sleep(150);
    agt.pen(0, 0, false);
    await sleep(400);
  }
})()`;

/** @type {Shot[]} */
const SHOTS = [
  { name: "room", hash: "#program=random-lines", dials: [0, 0.2, 0.3], setup: `document.getElementById("tab-tty").click()`, readme: "room.jpg" },
  { name: "console", hash: "#view=console&program=cube", dials: [0.2, 0.25, 0.3] },
  { name: "screen-tic-tac-toe", hash: "#view=screen&program=tic-tac-toe", setup: PLAY, readme: "screen.jpg" },
  { name: "screen-perspective-cube", hash: "#view=screen&program=perspective-cube", dials: [0.1, 0.15, 0.2] },
  { name: "screen-tunnel", hash: "#view=screen&program=tunnel", dials: [0.3, 0, 0] },
  { name: "screen-random-lines", hash: "#view=screen&program=random-lines", dials: [0, 0.2, 0.3] },
  { name: "tube-letter-a", hash: "#view=tube&program=letter-a", wait: 5000, ready: `(async () => { for (let i = 0; i < 100 && !stage.view3d.beam[0].core.visible; i++) await new Promise((r) => setTimeout(r, 30)); })()`, readme: "tube.jpg" },
  { name: "teletype-bump", hash: "#program=random-lines", setup: `document.getElementById("tab-tty").click(); [...document.querySelectorAll(".program-card button")].find((b) => b.textContent.startsWith("4,000"))?.click()`, wait: 6000 },
];

const { values } = parseArgs({ options: { out: { type: "string" }, only: { type: "string" }, readme: { type: "boolean" } } });
const out = values.out ? resolve(values.out) : mediaDir("shots");
mkdirSync(out, { recursive: true });
if (values.readme) mkdirSync(join(ROOT, "images", "readme"), { recursive: true });

const browser = await openBrowser({ width: WIDTH, height: HEIGHT });
try {
  for (const shot of SHOTS.filter((s) => !values.only || s.name.includes(values.only))) {
    await browser.load("", shot.hash);
    await sleep(2500);
    if (shot.dials) await browser.evaluate(`${JSON.stringify(shot.dials)}.forEach((v, n) => agt.setDial(n, v))`);
    if (shot.setup) await browser.evaluate(shot.setup);
    await sleep(shot.wait ?? 2500);
    if (shot.ready) await browser.evaluate(shot.ready);
    const r = await browser.send("Page.captureScreenshot", { format: "jpeg", quality: QUALITY });
    const jpeg = Buffer.from(r.result.data, "base64");
    writeFileSync(join(out, `${shot.name}.jpg`), jpeg);
    if (values.readme && shot.readme) writeFileSync(join(ROOT, "images", "readme", shot.readme), jpeg);
    if (browser.errors.length) throw new Error(`${shot.name}: ${browser.errors.join("; ")}`);
    process.stdout.write(`${shot.name}.jpg\n`);
  }
} finally {
  await browser.close();
}
process.stdout.write(`shots: ${out}\n`);
