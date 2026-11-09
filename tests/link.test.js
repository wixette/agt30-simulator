// SPDX-License-Identifier: Apache-2.0
//
// The link format (docs/ui-design.md, U13; P8): what a link reads and writes.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatLink, parseLink, VIEWS } from "../js/app/link.js";
import { PROGRAMS } from "./boot.js";

const ids = PROGRAMS.manifest.programs.map((p) => p.id);

describe("links", () => {
  it("name the four viewpoints of v0.0.1 (V6)", () => assert.deepEqual([...VIEWS], ["room", "console", "screen", "tube"]));
  it("read a viewpoint and a program", () => assert.deepEqual(parseLink("#view=tube&program=tic-tac-toe", ids), { view: "tube", program: "tic-tac-toe" }));
  it("ignore what they do not know", () => assert.deepEqual(parseLink("#view=attic&program=pong&x=1", ids), {}));
  it("write the Room, the way in, as nothing", () => assert.equal(formatLink({ view: "room" }), ""));
  it("round-trip", () => {
    for (const view of VIEWS) for (const program of [undefined, ...ids]) {
      const link = { view, program };
      const back = parseLink(formatLink(link), ids);
      assert.deepEqual(back, view === "room" ? (program ? { program } : {}) : program ? { view, program } : { view });
    }
  });
  it("never carry octal words: only these two fields (U13)", () => assert.match(formatLink({ view: "screen", program: "cube" }), /^#view=screen&program=cube$/));
});
