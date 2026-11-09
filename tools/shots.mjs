// SPDX-License-Identifier: Apache-2.0
//
// The release screenshots, `pnpm shots`: the README's picture and a set for posts.
//
//     pnpm shots                     (into ~/Downloads/agt30-v<version>-media/shots/)
//     pnpm shots --out ~/Pictures/x  (elsewhere)
//     pnpm shots --only tube         (the shots whose name contains "tube")
//     pnpm shots --readme            (also write the README's picture, images/readme/app.jpg)
//
// It drives headless Chrome at 1600 x 900 (tools/headless.mjs) and writes JPEGs. Each shot loads
// the page afresh with a link (#view=...&program=...), sets the dials, and waits. Release media
// are never kept in the repository; the README's picture is the one exception, committed.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { mediaDir, openBrowser, ROOT, sleep } from "./headless.mjs";

const WIDTH = 1600;
const HEIGHT = 900;
const QUALITY = 90;

/**
 * A shot: its file name, the link it loads, the dials (0-2) it sets, JavaScript run in the page
 * before it is taken, and how long to wait.
 * @typedef {{ name: string; hash: string; dials?: number[]; setup?: string; wait?: number }} Shot
 */

/** @type {Shot[]} */
const SHOTS = [
  { name: "room", hash: "#program=tic-tac-toe", dials: [0.12, 0.08, -0.1], setup: `document.getElementById("tab-tty").click()` },
  { name: "console", hash: "#view=console&program=cube", dials: [0.2, 0.25, 0.3] },
  { name: "screen-tic-tac-toe", hash: "#view=screen&program=tic-tac-toe", dials: [0.12, 0.08, -0.1] },
  { name: "screen-perspective-cube", hash: "#view=screen&program=perspective-cube", dials: [0.1, 0.15, 0.2] },
  { name: "screen-tunnel", hash: "#view=screen&program=tunnel", dials: [0.3, 0, 0] },
  { name: "screen-random-lines", hash: "#view=screen&program=random-lines", dials: [0, 0.2, 0.3] },
  { name: "tube-letter-a", hash: "#view=tube&program=letter-a", wait: 5000 },
  { name: "teletype-bump", hash: "#program=random-lines", setup: `document.getElementById("tab-tty").click(); [...document.querySelectorAll(".program-card button")].find((b) => b.textContent.startsWith("4,000"))?.click()`, wait: 6000 },
];

const { values } = parseArgs({ options: { out: { type: "string" }, only: { type: "string" }, readme: { type: "boolean" } } });
const out = values.out ? resolve(values.out) : mediaDir("shots");
mkdirSync(out, { recursive: true });

const browser = await openBrowser({ width: WIDTH, height: HEIGHT });
try {
  for (const shot of SHOTS.filter((s) => !values.only || s.name.includes(values.only))) {
    await browser.load("", shot.hash);
    await sleep(2500);
    if (shot.dials) await browser.evaluate(`${JSON.stringify(shot.dials)}.forEach((v, n) => agt.setDial(n, v))`);
    if (shot.setup) await browser.evaluate(shot.setup);
    await sleep(shot.wait ?? 2500);
    const r = await browser.send("Page.captureScreenshot", { format: "jpeg", quality: QUALITY });
    const jpeg = Buffer.from(r.result.data, "base64");
    writeFileSync(join(out, `${shot.name}.jpg`), jpeg);
    if (values.readme && shot.name === "room") writeFileSync(join(ROOT, "images", "readme", "app.jpg"), jpeg);
    if (browser.errors.length) throw new Error(`${shot.name}: ${browser.errors.join("; ")}`);
    process.stdout.write(`${shot.name}.jpg\n`);
  }
} finally {
  await browser.close();
}
process.stdout.write(`shots: ${out}\n`);
