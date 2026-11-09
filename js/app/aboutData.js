// SPDX-License-Identifier: Apache-2.0
//
// What About lists (U14), without the DOM, so the tests can read it: the ids of
// design/reconstructions.md, R1 to R20, whose short forms are the messages recon.R1 ...
// recon.R20 (tests/app.test.js keeps the two lists the same), and the source repository.

export const RECONSTRUCTIONS = Array.from({ length: 20 }, (_, i) => `R${i + 1}`);

/** The source repository, the one outside address the page names. */
export const SOURCE_URL = "https://github.com/wixette/agt30-simulator";
