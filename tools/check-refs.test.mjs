// SPDX-License-Identifier: Apache-2.0
//
// Tests for the reference check (tools/check-refs.mjs). The real forbidden names are not
// spelt here either: these tests use a made-up name and its digest.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { candidates, checkLinks, checkText, FORBIDDEN, linkTargets } from "./check-refs.mjs";

/** @param {string} s */
const sha = (s) => createHash("sha256").update(s).digest("hex");
const MADE_UP = new Set([sha("acme-secret-works"), sha("acmesecretworks"), sha("zork")]);

test("the forbidden names are held as SHA-256 digests only", () => {
  assert.ok(FORBIDDEN.size > 0);
  for (const d of FORBIDDEN) assert.match(d, /^[0-9a-f]{64}$/);
});

test("a forbidden name is found in any case and any spelling of its joins", () => {
  for (const text of ["See acme-secret-works.", "ACME-SECRET-WORKS", "acme secret works", "acme_secret_works", "AcmeSecretWorks", "@zork/web"]) {
    assert.equal(checkText("a.md", text, MADE_UP).length, 1, text);
  }
  assert.deepEqual(checkText("a.md", "acme works in secret; zorkish", MADE_UP), []);
});

test("candidates are the words and their short runs", () => {
  assert.deepEqual(candidates("A b"), ["a", "a-b", "ab", "b"]);
});

test("absolute paths on a developer's machine are found", () => {
  assert.equal(checkText("a.md", "open /Users/alice/src/x.pdf").length, 1);
  assert.equal(checkText("a.sh", "cd /home/bob/work/").length, 1);
  assert.equal(checkText("a.md", "C:\\Users\\carol\\Desktop\\x").length, 1);
  assert.deepEqual(checkText("a.md", "https://example.org/Users/alice/x"), []);
  assert.deepEqual(checkText("a.md", "no absolute local paths (`/Users/…`)"), []);
});

test("links are read from Markdown and HTML, but not from code", () => {
  const md = ["[a](docs/a.md) and [b](<docs/b c.md> \"title\")", "`[not](a-link.md)`", "```", "[not](in-a-fence.md)", "```", '<img src="images/logo.svg">'].join("\n");
  assert.deepEqual(
    linkTargets("README.md", md).map((l) => l.target),
    ["docs/a.md", "docs/b c.md", "images/logo.svg"],
  );
});

test("a relative link must stay inside the repository and lead somewhere", () => {
  const root = mkdtempSync(path.join(tmpdir(), "refs-"));
  mkdirSync(path.join(root, "docs"));
  writeFileSync(path.join(root, "docs", "a.md"), "# A\n");
  writeFileSync(path.join(root, "README.md"), "");
  /** @param {string} file @param {string} text */
  const check = (file, text) => checkLinks(root, file, text);
  assert.deepEqual(check("README.md", "[a](docs/a.md#part) [b](/docs/a.md) [web](https://x.org) [top](#top)"), []);
  assert.deepEqual(check("docs/a.md", "[up](../README.md)"), []);
  assert.match(check("docs/a.md", "[out](../../elsewhere/x.md)")[0], /leaves the repository/);
  assert.match(check("README.md", "[gone](docs/missing.md)")[0], /broken link/);
  assert.match(check("README.md", "[odd](docs/100%.md)")[0], /malformed link/);
});
