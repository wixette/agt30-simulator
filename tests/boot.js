// SPDX-License-Identifier: Apache-2.0
//
// Test helpers: the programs read from disk, and a booted AGT-30.

import { readFile } from "node:fs/promises";
import { Agt30 } from "../js/sim/agt.js";
import { readPrograms } from "../js/sim/programs.js";

const DIR = new URL("../programs/", import.meta.url);

/** The manifest and sources, read once. */
export const PROGRAMS = await readPrograms((name) => readFile(new URL(name, DIR), "utf8"));

/** @returns {Agt30} a new AGT-30, as it starts */
export const boot = () => Agt30.boot(PROGRAMS.sources);
