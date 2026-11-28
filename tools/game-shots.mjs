// SPDX-License-Identifier: Apache-2.0
//
// Screenshots of NCSU's software and the operator's panel, for posts and letters:
//
//     pnpm game-shots                                    (into ~/Downloads/agt30-v<version>-media/games/)
//     node tools/game-shots.mjs --only life
//
// - panel.png: the operator's control panel in 3D on its rack, above the same panel in the
//   Panel tab;
// - life.png: LIFE with the Gosper glider gun, entered with LIFE's own keys, run until a stream
//   of gliders is out, then stopped (stopped, LIFE refreshes every frame; running fast it draws
//   only between generations, and a picture taken then is mostly dark);
// - space-war.png: Space War's two ships around the star.
//
// The page loads NCSU's system pack from the repository's copy (packs/NOTICE). Pictures are PNG
// at twice the window's pixels.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { mediaDir, openBrowser, sleep } from "./headless.mjs";

const { values: args } = parseArgs({ options: { out: { type: "string" }, only: { type: "string" } } });
const OUT = resolve(args.out ?? mediaDir("games"));
mkdirSync(OUT, { recursive: true });
const want = (/** @type {string} */ name) => !args.only || name.includes(args.only);

/** The Gosper glider gun, cells (x, y) with y down. */
const GUN = [[24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],[11,3],[15,3],[20,3],[21,3],[34,3],[35,3],[0,4],[1,4],[10,4],[16,4],[20,4],[21,4],[0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],[10,6],[16,6],[24,6],[11,7],[15,7],[12,8],[13,8]];

/**
 * LIFE's key taps that draw the gun with its top-left (ox, oy) cells from the cursor: 5 and 6
 * move it left and right, 9 and 10 up and down, 7 sets the cell under it.
 * @param {number} ox
 * @param {number} oy
 * @returns {number[]}
 */
function gunTaps(ox, oy) {
  /** @type {number[]} */
  const out = [];
  let cx = 0;
  let cy = 0;
  const rows = [...new Set(GUN.map(([, y]) => y))].sort((a, b) => a - b);
  rows.forEach((y, r) => {
    const xs = GUN.filter(([, yy]) => yy === y).map(([x]) => x).sort((a, b) => (r % 2 ? b - a : a - b));
    for (const x of xs) {
      for (; cx < ox + x; cx++) out.push(6);
      for (; cx > ox + x; cx--) out.push(5);
      for (; cy < oy + y; cy++) out.push(10);
      for (; cy > oy + y; cy--) out.push(9);
      out.push(7);
    }
  });
  return out;
}

/**
 * Opens the page at twice the pixels.
 * @param {number} width
 * @param {number} height
 */
async function open(width, height) {
  const b = await openBrowser({ width, height });
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false });
  await b.load("", "#view=screen");
  return b;
}

/** @param {import("./headless.mjs").Browser} b @param {string} id the program's title in the menu */
async function loadProgram(b, id) {
  await b.evaluate(`document.getElementById("programs").click()`);
  await sleep(400);
  await b.evaluate(`[...document.querySelectorAll(".menu *")].find((e) => e.textContent.trim() === ${JSON.stringify(id)} && e.closest("button,[role=menuitem]")).click()`);
  for (let i = 0; i < 30 && !(await b.evaluate("!!agt.bare")); i++) await sleep(500);
  await sleep(1500);
}

/** @param {import("./headless.mjs").Browser} b @param {string} sel @returns {Promise<number[]>} */
const rect = (b, sel) => b.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`);

/** @param {import("./headless.mjs").Browser} b @param {number[]} r @returns {Promise<Buffer>} */
async function clip(b, [x, y, width, height]) {
  const s = await b.send("Page.captureScreenshot", { format: "png", clip: { x, y, width, height, scale: 1 } });
  return Buffer.from(s.result.data, "base64");
}

/** The stage alone, the dock folded and the band's controls out of the picture. */
async function stageShot(/** @type {import("./headless.mjs").Browser} */ b) {
  await b.evaluate(`document.getElementById("band").style.visibility = "hidden"`);
  await sleep(300);
  return clip(b, await rect(b, "#stage"));
}

/** Taps a function key as a hand would: 80 ms down, 120 ms up (LIFE misses shorter gaps). */
const TAP = "async (k) => { agt.setKey(k, true); await new Promise((r) => setTimeout(r, 80)); agt.setKey(k, false); await new Promise((r) => setTimeout(r, 120)); }";

/** LIFE's live cells, counted in its board in core (from 200, 128 a row). */
const LIVE = "(() => { let n = 0; for (let a = 0o200; a < 0o200 + 128 * 128; a++) if (agt.core.read(a) === 0o2400042532) n++; return n; })()";

const save = (/** @type {string} */ name, /** @type {Buffer} */ png) => {
  writeFileSync(join(OUT, name), png);
  console.log(join(OUT, name));
};

if (want("panel")) {
  const b = await open(1440, 1200);
  try {
    await b.evaluate(`localStorage.setItem("agt30.dock", JSON.stringify({ tab: "panel", height: 470 }))`);
    await b.load("", "#view=panel");
    await sleep(3500);
    await b.evaluate(`document.getElementById("strip").style.visibility = "hidden"; document.getElementById("band").style.visibility = "hidden"`);
    await sleep(500);
    const st = await rect(b, "#stage");
    // the panel on its rack fills the stage's middle in the Panel viewpoint
    const three = await clip(b, [st[0] + 0.075 * st[2], st[1] + 0.09 * st[3], 0.855 * st[2], 0.70 * st[3]]);
    const face = await rect(b, ".ocp");
    const bar = await rect(b, ".ocp-bar");
    const two = await clip(b, [face[0] - 12, bar[1] - 6, face[2] + 24, face[1] + face[3] - bar[1] + 18]);
    // the two stacked, each labeled, at the Panel tab's width, on a canvas in the page
    const png = await b.evaluate(`(async () => {
      const load = (b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + b64; });
      const [a, z] = await Promise.all([load("${three.toString("base64")}"), load("${two.toString("base64")}")]);
      const pad = 80, lab = 112, gap = 60, w = z.width, ha = Math.round((a.height * w) / a.width);
      const c = document.createElement("canvas");
      c.width = w + 2 * pad;
      c.height = pad + lab + ha + gap + lab + z.height + pad;
      const g = c.getContext("2d");
      g.fillStyle = "#1b1c1e";
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = "#d8d4c8";
      g.font = "60px -apple-system, Helvetica, Arial, sans-serif";
      g.textBaseline = "middle";
      g.fillText("The operator's control panel in 3D, on the processor rack", pad, pad + lab / 2);
      g.drawImage(a, pad, pad + lab, w, ha);
      g.fillText("The same panel in the Panel tab", pad, pad + lab + ha + gap + lab / 2);
      g.drawImage(z, pad, pad + 2 * lab + ha + gap);
      return c.toDataURL("image/png").split(",")[1];
    })()`);
    save("panel.png", Buffer.from(png, "base64"));
  } finally {
    await b.close().catch(() => {});
  }
}

if (want("life")) {
  const b = await open(1440, 1640);
  try {
    await b.evaluate(`document.getElementById("dock-fold").click()`);
    await loadProgram(b, "LIFE (NCSU, 1975)");
    await b.evaluate("agt.setDial(0, -0.95)");
    // the gun up and left, so its gliders cross the screen; the cursor stays by it (taken far
    // off, it takes LIFE's picture with it)
    const taps = gunTaps(-55, -50);
    await b.evaluate(`window.tapsDone = false; (async () => { const tap = ${TAP}; for (const k of ${JSON.stringify(taps)}) await tap(k); window.tapsDone = true; })(); 0`);
    for (let i = 0; i < 300 && !(await b.evaluate("window.tapsDone")); i++) await sleep(1000);
    console.log("LIFE: cells set", await b.evaluate(LIVE), "of", GUN.length);
    await b.evaluate(`(${TAP})(1)`);
    await sleep(40000);
    // between generations at speed LIFE reads the keys seldom: 0 is held until it is seen
    await b.evaluate(`(async () => { agt.setKey(0, true); await new Promise((r) => setTimeout(r, 1500)); agt.setKey(0, false); })()`);
    await sleep(2500);
    console.log("LIFE: cells after the run", await b.evaluate(LIVE), b.errors);
    save("life.png", await stageShot(b));
  } finally {
    await b.close().catch(() => {});
  }
}

if (want("space-war")) {
  const b = await open(1440, 1640);
  try {
    await b.evaluate(`document.getElementById("dock-fold").click()`);
    await loadProgram(b, "Space War (NCSU, 1975)");
    await sleep(3000);
    save("space-war.png", await stageShot(b));
  } finally {
    await b.close().catch(() => {});
  }
}
