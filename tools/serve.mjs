// SPDX-License-Identifier: Apache-2.0
//
// A static server for working on the page: `pnpm serve` (port 8000, or the first
// argument). It is a plain file server like `python3 -m http.server`, with one difference:
// it tells the browser not to keep anything (Cache-Control: no-store). Every file the page
// loads carries the release's version in its name (?v=, tools/stamp.mjs), so between
// releases a changed module keeps the old name, and a caching browser would go on showing
// the old one. Published copies are served with normal caching (docs/development.md).

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.argv[2] ?? 8000);

/** @type {Record<string, string>} */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".adept": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT.replace(/[\\/]$/, ""))) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) {
      res.writeHead(301, { Location: `${path}/` }).end();
      return;
    }
    file = join(file, "index.html");
  }
  if (!existsSync(file) || file.split(sep).includes("node_modules")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => process.stdout.write(`Serving the simulator at http://localhost:${PORT}/ (no caching)\n`));
