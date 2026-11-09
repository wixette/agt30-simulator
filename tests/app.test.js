// SPDX-License-Identifier: Apache-2.0
//
// The page's data (design/v0.0.1.md, section 4, APP): About lists every reconstruction, and
// nothing the page loads leaves the site (P10: no fonts or scripts from elsewhere).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { RECONSTRUCTIONS, SOURCE_URL } from "../js/app/aboutData.js";

const ROOT = new URL("../", import.meta.url);
/** @param {string} dir @param {string[]} ends @returns {string[]} */
const walk = (dir, ends) => readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`, ends) : ends.some((x) => e.name.endsWith(x)) ? [`${dir}/${e.name}`] : []));

describe("the page (APP)", () => {
  it("APP-1: About lists every reconstruction of design/reconstructions.md, in order (U14)", () => {
    const doc = readFileSync(new URL("design/reconstructions.md", ROOT), "utf8");
    const ids = [...doc.matchAll(/^\*\*(R\d+)\. /gm)].map((m) => m[1]);
    assert.deepEqual(RECONSTRUCTIONS, ids);
  });

  it("APP-2: nothing the page loads comes from another site (P10)", () => {
    const files = [...walk("js", [".js"]), ...walk("css", [".css"]), "index.html"];
    for (const f of files) {
      const src = readFileSync(new URL(f, ROOT), "utf8");
      for (const m of src.matchAll(/(?:\bsrc=|\bhref=|url\(|\bimport\s*\(?|\bfrom\s+|fetch\()\s*["'`]?(https?:)?\/\/[^"'`)\s]+/g)) assert.fail(`${f} loads ${m[0]}`);
    }
  });

  it("APP-3: the only outside address is the source repository's link, in About", () => {
    const files = [...walk("js", [".js"]), "index.html"];
    const urls = new Set();
    for (const f of files) {
      if (f.startsWith("js/accept/") || f.startsWith("js/sim/")) continue;
      // addresses in strings and attributes, not in comments
      for (const m of readFileSync(new URL(f, ROOT), "utf8").matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) urls.add(m[1]);
    }
    assert.deepEqual([...urls].filter((u) => u !== SOURCE_URL && !u.startsWith("http://www.w3.org/")), []);
  });
});
