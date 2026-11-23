// SPDX-License-Identifier: Apache-2.0
//
// Facts About, the References tab and the cards use, without the DOM, so the tests can read them:
// the ids of design/reconstructions.md, R1 to R20, whose short forms are the messages recon.R1 ...
// recon.R20 (the cards show those a program rests on; the README lists them all, and
// tests/app.test.js keeps the lists the same); the source repository; and the references, the
// only other addresses the page names (tests/app.test.js, APP-3).

export const RECONSTRUCTIONS = Array.from({ length: 23 }, (_, i) => `R${i + 1}`);

/** The source repository. */
export const SOURCE_URL = "https://github.com/wixette/agt30-simulator";

/**
 * The References tab (U16), by group: each a message, refs.<group>.<id>, and where it is; the keys
 * are those of research/bibliography.md where it has them.
 * @type {[string, [string, string][]][]}
 */
export const REFERENCES = [
  [
    "history",
    [
      ["ncsu", "https://www.graphics-history.org/ncsu/index.htm"],
      ["ghh", "https://www.graphics-history.org/hardware.htm"],
      ["bro68", "http://www.bitsavers.org/pdf/adage/agt/1968_Adage_AGT_Brochure.pdf"],
      ["bro69", "http://www.bitsavers.org/pdf/adage/agt/1969_Adage_AGT_Brochure.pdf"],
    ],
  ],
  [
    "adage",
    [
      ["prm1", "http://www.bitsavers.org/pdf/adage/agt/Adage_AGT_Programmers_Reference_Manual_Volume_I_196907.pdf"],
      ["srm5", "http://www.bitsavers.org/pdf/adage/agt/Adage_Graphics_Terminal_Model_5_System_Reference_Manual_196907.pdf"],
      ["gim72", "http://www.bitsavers.org/pdf/adage/agt/Adage_Graphics_Systems_General_Information_Manual_1972.pdf"],
      ["all", "http://www.bitsavers.org/pdf/adage/"],
    ],
  ],
  [
    "tapes",
    [
      ["mh25", "https://github.com/cramcram/AGT-30"],
      ["mh25doc", "https://github.com/cramcram/AGT-30/tree/master/doc"],
      ["rt", "https://github.com/LenShustek/readtape"],
    ],
  ],
  [
    "source",
    [
      ["repo", SOURCE_URL],
      ["research", `${SOURCE_URL}/tree/main/research`],
      ["bibliography", `${SOURCE_URL}/blob/main/research/bibliography.md`],
    ],
  ],
];
