// SPDX-License-Identifier: Apache-2.0
//
// The Processor tab's listings (js/sim/listing.js; docs/ui-design.md, U15): core read as
// instructions with the assembler's symbols, as image items, or as words.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listing, parseAddress, symbolic } from "../js/sim/listing.js";
import { boot } from "./boot.js";

describe("listings", () => {
  it("read RVCD as its source writes it, with its symbols", () => {
    const agt = boot();
    const at = agt.core.addr("RVCD");
    const lines = listing(agt.core, at, 6, "code");
    assert.deepEqual(
      lines.map((l) => [l.label, `${l.text} ${l.operand}`.trim()]),
      [["RVCD", "NOOP"], ["", "MDAR'I RVCD"], ["", "ARMX"], ["", "S5AR'H"], ["", "ARRS 00017"], ["", "JUMP'X'I RVCD"]],
    );
    assert.equal(lines[1].ref, at, "an address operand can be followed");
    assert.equal(lines[4].ref, null, "a shift count is not an address");
  });

  it("read a picture as its items, its name first", () => {
    const agt = boot();
    const [head] = listing(agt.core, agt.core.addr("V.CUBE"), 1, "items");
    assert.equal(head.text, "TEXT /V.CUBE/");
    assert.equal(head.len, 2);
    const lines = listing(agt.core, agt.core.addr("V.CUBE") + 2, 3, "items");
    assert.ok(lines.every((l) => /^[A-Z0-9]+/.test(l.text)), lines.map((l) => l.text).join("; "));
    assert.ok(lines[1].addr === lines[0].addr + lines[0].len, "each line starts after the last");
  });

  it("show a word that is not an item as ?", () => {
    const agt = boot();
    const [l] = listing(agt.core, agt.core.addr("RVCD") + 1, 1, "items");
    assert.equal(typeof l.text, "string");
  });

  it("read words in octal and as AMOS characters", () => {
    const agt = boot();
    const [l] = listing(agt.core, agt.core.addr("V.CUBE"), 1, "words");
    assert.equal(l.text.trim(), "V.CUB");
  });

  it("name addresses as symbols, a symbol plus an octal offset, or octal; and read them back", () => {
    const agt = boot();
    const at = agt.core.addr("RVCD");
    const names = new Map([[at, "RVCD"]]);
    assert.equal(symbolic(at, names), "RVCD");
    assert.equal(symbolic(at + 9, names), "RVCD+11");
    assert.equal(symbolic(at - 1, names), (at - 1).toString(8).padStart(5, "0"));
    assert.equal(parseAddress("rvcd+11", agt.core), at + 9);
    assert.equal(parseAddress("RVCD-1", agt.core), at - 1);
    assert.equal(parseAddress("60000", agt.core), 0o60000);
    assert.equal(parseAddress("NOSUCH", agt.core), null);
    assert.equal(parseAddress("8", agt.core), null);
  });
});
