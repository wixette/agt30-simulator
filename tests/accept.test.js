// SPDX-License-Identifier: Apache-2.0
//
// The acceptance checks (js/accept/), one Node test each, named by its ID.

import { describe, it } from "node:test";
import { MODEL_CHECKS } from "../js/accept/model.js";
import { boot, PROGRAMS } from "./boot.js";

const ctx = { boot, manifest: PROGRAMS.manifest, sources: PROGRAMS.sources };

describe("acceptance: the model", () => {
  for (const c of MODEL_CHECKS) it(`${c.id}: ${c.title}`, () => c.run(ctx));
});
