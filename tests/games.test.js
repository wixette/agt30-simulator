// SPDX-License-Identifier: Apache-2.0
//
// NCSU's games, run from the repository's copies of the system pack and the games tape
// (packs/NOTICE): what each shows when it runs as the lab ran it (U19, R22, R24).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dumpOf, readTape } from "../js/sim/amostape.js";
import { readPack } from "../js/sim/bare.js";
import { boot } from "./boot.js";

const ROOT = new URL("../", import.meta.url);
const pack = readPack(readFileSync(new URL("packs/howard.disk", ROOT)).buffer);
const tape = readTape(new Uint8Array(readFileSync(new URL("packs/games.tape", ROOT))));

/**
 * A game started as the Programs menu starts it, with what the Teletype prints and the vectors
 * AVG1 draws, and a clock to run it by.
 * @param {import("../js/sim/bare.js").GameId} id
 * @param {object} [from]
 */
function start(id, from) {
  const agt = boot();
  agt.startGame(id, pack, from);
  const bare = /** @type {import("../js/sim/bare.js").Bare} */ (agt.bare);
  /** @type {number[]} */
  const out = [];
  const printed = bare.line.printed;
  bare.line.printed = (c) => {
    out.push(c & 0o177);
    printed(c);
  };
  let t = agt.now;
  const run = (/** @type {number} */ ms) => {
    for (const end = t + ms * 1000; t < end; ) agt.advanceTo((t += 10000));
  };
  const text = () => String.fromCharCode(...out).replace(/\r/g, "");
  return { agt, bare, run, text };
}

describe("NCSU's games", () => {
  it("BROSE, restored from the games tape and called by AMRMX, draws its rose, pauses, and ends on PULSE 1", () => {
    const f = tape.find((x) => x.name === "BROSE" && x.type === "DUMP");
    assert.ok(f, "BROSE on the tape");
    const { agt, bare, run, text } = start("brose", { tape: dumpOf(f), date: "11/29/76" });
    run(15000);
    assert.match(text(), /PAUSE/, "it pauses");
    assert.ok(bare.avg.vectors > 1000, `it draws (${bare.avg.vectors} vectors)`);
    assert.equal(agt.cpu.stopped ?? null, null, "nothing unknown executed");
    // the rose stays on the screen while BROSE waits: restored after AMRMX's start, the dump's
    // monitor state is kept (Bare.then)
    const v0 = bare.avg.vectors;
    run(1000);
    assert.ok(bare.avg.vectors - v0 > 5000, `refreshed during the pause (${bare.avg.vectors - v0} vectors a second)`);
    const atPause = agt.cpu.LC;
    agt.setPulse1(true);
    run(100);
    agt.setPulse1(false);
    run(3000);
    assert.notEqual(agt.cpu.LC, atPause, "PULSE 1 ended the pause");
  });

  it("QUBIC asks for a move on the Teletype and draws its board in three dimensions", () => {
    const { agt, bare, run, text } = start("qubic");
    run(4000);
    assert.match(text(), /TYPE YOUR MOVE/);
    assert.ok(bare.avg.vectors > 500, `the board drawn (${bare.avg.vectors} vectors)`);
    agt.type("111\r");
    run(5000);
    agt.type("YES\r");
    run(8000);
    assert.match(text(), /MY MOVE IS \d\d\d/, "it answers with its own move");
  });
});
