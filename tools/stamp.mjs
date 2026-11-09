// SPDX-License-Identifier: Apache-2.0
//
// Writes the version into every file name the page gives, so that a cache (the browser's,
// or a CDN's) can keep each file as long as it likes: a new release asks for new names.
//
//     pnpm version 0.0.2    (sets the version, then runs this)
//     pnpm stamp            (after a version set any other way)
//
// tests/stamp.test.js fails while the page and package.json disagree. It edits the page in
// place; there is no build, and no second copy of the page:
//
// - each local file the page names by src or href gets ?v=<version>;
// - its import map gives every module the same: the bare names ("three",
//   "three/addons/…"), every .js file in js/ and vendor/, the JSON in params/ (imported
//   as modules) and package.json (About shows the version);
// - each local file a stylesheet in css/ names by url() (the font files) gets the same;
// - the files the scripts fetch themselves (programs/) take the version from the URL of
//   the module that loads them (import.meta.url).
//
// The page itself is never cached for long (docs/development.md), so it is always the
// newest, and so are the names in it.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The pages that load modules: one (docs/conventions.md, "No developer pages"). */
export const PAGES = ["index.html"];

/**
 * Files under a folder of the repository with one of the given endings, relative to the
 * repository root.
 * @param {string} root
 * @param {string} dir
 * @param {string[]} endings
 * @returns {string[]}
 */
const walk = (root, dir, endings) =>
  !existsSync(join(root, dir))
    ? []
    : readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(root, `${dir}/${e.name}`, endings) : endings.some((x) => e.name.endsWith(x)) ? [`${dir}/${e.name}`] : [],
      );

/**
 * Every module a page may load, relative to the repository root: the .js files in js/ and
 * vendor/, the JSON in params/, and package.json (About shows the version).
 * @param {string} [root]
 * @returns {string[]}
 */
export function moduleFiles(root = ROOT) {
  return [...walk(root, "js", [".js"]), ...walk(root, "vendor", [".js"]), ...walk(root, "params", [".json"]), "package.json"].sort();
}

/**
 * The stylesheets whose url()s are stamped.
 * @param {string} [root]
 * @returns {string[]}
 */
export function stylesheets(root = ROOT) {
  return walk(root, "css", [".css"]).sort();
}

/**
 * A stylesheet, with the version in every local file its url()s name. Stamping a stamped
 * stylesheet again changes nothing.
 * @param {string} css
 * @param {string} version
 * @returns {string}
 */
export function stampCss(css, version) {
  return css.replace(/url\((["']?)(?![a-z]+:|\/\/|#)([^?#"')]+\.[a-z0-9]+)(\?v=[^"')]*)?\1\)/gi, (_w, q, file) => `url(${q}${file}?v=${version}${q})`);
}

/**
 * A page, with the version in every local file name and in its import map. Stamping a
 * stamped page again changes nothing.
 * @param {string} html the page
 * @param {string} page its path from the repository root
 * @param {string} version as package.json has it
 * @param {string[]} modules from moduleFiles()
 * @returns {string}
 */
export function stamp(html, page, version, modules) {
  const v = `?v=${version}`;
  const up = relative(dirname(page), ".").split("\\").join("/");
  /** @param {string} file */
  const url = (file) => (up ? `${up}/${file}` : `./${file}`);
  // A file of the site's own: not a link elsewhere, nor a fragment, nor a folder.
  const local = /^(?![a-z]+:|\/\/|#)([^?#"]+\.[a-z0-9]+)(\?v=[^"#]*)?$/i;
  let out = html.replace(/\b(src|href)="([^"]*)"/g, (whole, attr, u) => {
    const m = u.match(local);
    return m ? `${attr}="${m[1]}${v}"` : whole;
  });
  /** @type {Record<string, string>} */
  const imports = {
    three: url("vendor/three/build/three.module.js") + v,
  };
  for (const f of modules.filter((f) => f.startsWith("vendor/three/examples/jsm/"))) {
    imports[`three/addons/${f.slice("vendor/three/examples/jsm/".length)}`] = url(f) + v;
  }
  for (const file of modules) imports[url(file)] = url(file) + v;
  const json = JSON.stringify({ imports }, null, 2).replace(/\n/g, "\n    ");
  const block = /(<script type="importmap">\n    )[\s\S]*?(\n    <\/script>)/;
  if (!block.test(out)) throw new Error(`${page} has no import map to stamp`);
  return out.replace(block, (_whole, open, close) => open + json + close);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  const modules = moduleFiles();
  for (const page of PAGES) {
    const before = readFileSync(join(ROOT, page), "utf8");
    const after = stamp(before, page, version, modules);
    if (after !== before) writeFileSync(join(ROOT, page), after);
    process.stdout.write(`${page} ${after === before ? "already has" : "now has"} version ${version} in its file names.\n`);
  }
  for (const sheet of stylesheets()) {
    const before = readFileSync(join(ROOT, sheet), "utf8");
    const after = stampCss(before, version);
    if (after !== before) writeFileSync(join(ROOT, sheet), after);
  }
}
