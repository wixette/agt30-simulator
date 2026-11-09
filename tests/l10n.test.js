// SPDX-License-Identifier: Apache-2.0
//
// Every text is a message (docs/ui-design.md, U11): a key used in the page or the code has a
// message in js/l10n/en.js, and every message there is used. Keys built at run time are listed
// from the data they come from.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import en from "../js/l10n/en.js";
import { RECONSTRUCTIONS } from "../js/app/aboutData.js";
import { VIEWS } from "../js/app/link.js";
import { PROGRAMS } from "./boot.js";

const ROOT = new URL("../", import.meta.url);
/** @param {string} dir @returns {string[]} */
const walk = (dir) => readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : []));

/** Keys named in the source: t("key"), t(`key`) without placeholders, data-l10n and data-l10n-tip. */
function staticKeys() {
  const keys = new Set();
  const files = [...walk("js").filter((f) => !f.startsWith("js/l10n/")), "index.html"];
  for (const f of files) {
    const src = readFileSync(new URL(f, ROOT), "utf8");
    for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9.-]+)"/g)) keys.add(m[1]);
    // t(condition ? "key" : "other"), whatever the condition
    for (const m of src.matchAll(/\bt\(\s*[^"`()]+?\?\s*"([a-zA-Z0-9.-]+)"\s*:\s*"([a-zA-Z0-9.-]+)"/g)) (keys.add(m[1]), keys.add(m[2]));
    for (const m of src.matchAll(/data-l10n(?:-tip)?="([a-zA-Z0-9.-]+)"/g)) keys.add(m[1]);
  }
  return keys;
}

/** Keys built at run time, from their data. */
function dynamicKeys() {
  const params = JSON.parse(readFileSync(new URL("params/terminal.json", ROOT), "utf8"));
  const keys = new Set();
  for (const p of PROGRAMS.manifest.programs) {
    for (const k of ["title", "use", "what"]) keys.add(`program.${p.id}.${k}`);
    for (const a of p.actions) keys.add(`program.action.${a.id}`);
  }
  for (const id of RECONSTRUCTIONS) keys.add(`recon.${id}`);
  for (const p of params.parts) keys.add(`part.${p.name}`).add(`part.${p.name}.what`);
  for (const n of ["funnel", "neck", "gun", "yoke", "base"]) keys.add(`part.console.scope.tube.${n}`).add(`part.console.scope.tube.${n}.what`);
  for (const c of params.cables) keys.add(c.name);
  keys.add("cable.what");
  for (const c of ["doc", "photo", "est", "design"]) keys.add(`confidence.${c}`);
  for (const v of VIEWS) keys.add(`view.${v}`);
  for (const s of ["waiting", "preparing", "drawing", "moving"]) keys.add(`trace.${s}`);
  for (const l of ["code", "content", "three", "font", "icons"]) keys.add(`about.licence.${l}`);
  return keys;
}

describe("messages (U11)", () => {
  const used = new Set([...staticKeys(), ...dynamicKeys()]);
  it("every key used has a message", () => assert.deepEqual([...used].filter((k) => !(k in en)), []));
  it("every message is used", () => assert.deepEqual(Object.keys(en).filter((k) => !used.has(k)), []));
});
