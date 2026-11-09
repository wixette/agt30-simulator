// SPDX-License-Identifier: Apache-2.0
//
// Facts About and the cards use, without the DOM, so the tests can read them: the ids of
// design/reconstructions.md, R1 to R20, whose short forms are the messages recon.R1 ...
// recon.R20 (the cards show those a program rests on; the README lists them all, and
// tests/app.test.js keeps the lists the same), and the source repository.

export const RECONSTRUCTIONS = Array.from({ length: 20 }, (_, i) => `R${i + 1}`);

/** The source repository, the one outside address the page names. */
export const SOURCE_URL = "https://github.com/wixette/agt30-simulator";
