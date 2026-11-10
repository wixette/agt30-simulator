// SPDX-License-Identifier: Apache-2.0
//
// The page in headless Chrome, for `pnpm shots` and for checking the page by script: serves
// the repository itself on a free port, starts Chrome with the GPU at a fixed window size and
// talks to it over the DevTools protocol. Chrome is found at its usual place, or set CHROME.
// After the Leibniz Stepped Reckoner simulator's (Apache-2.0).

import { spawn } from "node:child_process";
import { createReadStream, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { constants, homedir, tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Where release media go by default: outside the repository, in
 * ~/Downloads/agt30-v<version>-media/<kind>. Release media are never kept in the repository.
 * @param {string} kind "shots"
 * @returns {string}
 */
export function mediaDir(kind) {
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return join(homedir(), "Downloads", `agt30-v${version}-media`, kind);
}

/** @type {Record<string, string>} */
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".adept": "text/plain",
};

const CHROME =
  process.env.CHROME ??
  { darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }[
    /** @type {string} */ (process.platform)
  ] ??
  "google-chrome";

/** @param {number} ms */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @typedef {object} Browser
 * @property {(method: string, params?: object) => Promise<any>} send a DevTools command
 * @property {(expression: string) => Promise<any>} evaluate run JavaScript in the page, awaiting a promise
 * @property {(query?: string, hash?: string) => Promise<void>} load load the simulator afresh, with ?debug and a query, and wait until it runs
 * @property {string[]} errors exceptions the page threw since the last load
 * @property {() => Promise<void>} close
 */

/**
 * Serve the repository and open Chrome on it.
 * @param {{ width: number; height: number }} size
 * @returns {Promise<Browser>}
 */
export async function openBrowser({ width, height }) {
  const server = createServer((req, res) => {
    let file = normalize(join(ROOT, decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)));
    try {
      if (!file.startsWith(ROOT)) throw new Error();
      if (statSync(file).isDirectory()) file = join(file, "index.html");
      statSync(file);
    } catch {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(undefined)));
  const address = server.address();
  const site = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;

  const profile = mkdtempSync(join(tmpdir(), "agt30-headless-"));
  // Port 0: Chrome picks a free port and writes it to DevToolsActivePort in the profile, so a
  // run never talks to some other Chrome that holds a port it guessed.
  const chrome = spawn(
    CHROME,
    [
      "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--enable-gpu", "--hide-scrollbars",
      `--window-size=${width},${height}`, "--force-device-scale-factor=1", "--mute-audio",
      ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "about:blank",
    ],
    { stdio: "ignore" },
  );
  /** @type {Error | undefined} */
  let spawnError;
  chrome.once("error", (e) => (spawnError = e));
  const running = () => !spawnError && chrome.exitCode === null && chrome.signalCode === null;
  /** @type {WebSocket | undefined} */
  let ws;

  // Chrome outlives this process unless it is stopped: macOS and Linux do not end a child with
  // its parent. Every way out stops it: close(), a failed start, Ctrl-C, kill, a lost terminal.
  /** @type {Promise<void> | undefined} */
  let stopping;
  const stop = () =>
    (stopping ??= (async () => {
      live.delete(entry);
      ws?.close();
      server.close();
      if (running()) {
        const exited = new Promise((r) => chrome.once("exit", r));
        chrome.kill();
        if ((await Promise.race([exited, sleep(5000).then(() => "late")])) === "late") {
          chrome.kill("SIGKILL");
          await exited;
        }
      }
      rmSync(profile, { recursive: true, force: true });
    })());
  const entry = {
    stop,
    stopNow() {
      if (running()) chrome.kill("SIGKILL");
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
  live.add(entry);
  hookExit();

  try {
    /** @type {{ type: string; webSocketDebuggerUrl: string }[] | undefined} */
    let targets;
    for (let i = 0; i < 50 && !targets && running(); i++) {
      const port = Number.parseInt(readFileOr(join(profile, "DevToolsActivePort")), 10);
      if (port > 0) targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json(), () => undefined);
      if (!targets) await sleep(200);
    }
    const target = targets?.find((t) => t.type === "page");
    if (!target) throw new Error(`Chrome did not start (${CHROME}${spawnError ? `: ${spawnError.message}` : ""}); set CHROME to its path`);
    const socket = (ws = new WebSocket(target.webSocketDebuggerUrl));
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve);
      socket.addEventListener("error", () => reject(new Error("could not connect to Chrome")));
      socket.addEventListener("close", () => reject(new Error("could not connect to Chrome")));
    });
  } catch (e) {
    await stop();
    throw e;
  }
  const socket = /** @type {WebSocket} */ (ws);

  let nextId = 0;
  /** @type {Map<number, { resolve: (m: any) => void; reject: (e: Error) => void }>} */
  const replies = new Map();
  /** @type {string[]} */
  const errors = [];
  socket.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data));
    replies.get(m.id)?.resolve(m);
    replies.delete(m.id);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  // a command never answered would hang the run: when Chrome goes away, every one fails
  socket.addEventListener("close", () => {
    for (const { reject } of replies.values()) reject(new Error("Chrome closed the connection"));
    replies.clear();
  });
  /** @type {Browser["send"]} */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new Error("Chrome closed the connection"));
        return;
      }
      const id = ++nextId;
      replies.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  /** @type {Browser["evaluate"]} */
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  return {
    send,
    evaluate,
    errors,
    async load(query = "", hash = "") {
      errors.length = 0;
      // a blank page first: a link that differs only in its #... would not load the page afresh
      await send("Page.navigate", { url: "about:blank" });
      await sleep(100);
      await send("Page.navigate", { url: `${site}?debug${query ? `&${query}` : ""}${hash}` });
      await sleep(500);
      for (let i = 0; i < 150; i++) {
        if (await evaluate("!!window.agt").catch(() => false)) break;
        if (socket.readyState !== WebSocket.OPEN) throw new Error("Chrome closed the connection");
        await sleep(200);
      }
      await sleep(500);
    },
    close: stop,
  };
}

/** @param {string} file @returns {string} the file's text, or "" while it is not there */
function readFileOr(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** The browsers open now, each with a way to stop it and a last-moment one for process exit. */
/** @type {Set<{ stop: () => Promise<void>; stopNow: () => void }>} */
const live = new Set();
let hooked = false;

/**
 * On Ctrl-C, kill or a lost terminal, Node would exit at once and skip every `finally`: stop
 * the browsers first, then exit as the signal would have. A second signal exits at once, and
 * `exit` still kills what is left. On any other exit (process.exit, an uncaught error), `exit`
 * kills them, as only synchronous work can be done there.
 */
function hookExit() {
  if (hooked) return;
  hooked = true;
  for (const signal of /** @type {const} */ (["SIGINT", "SIGTERM", "SIGHUP"])) {
    process.once(signal, async () => {
      await Promise.allSettled([...live].map((b) => b.stop()));
      process.exit(128 + constants.signals[signal]);
    });
  }
  process.once("exit", () => {
    for (const b of live) b.stopNow();
  });
}
