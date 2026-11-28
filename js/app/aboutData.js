// SPDX-License-Identifier: Apache-2.0
//
// Facts About, the References tab and the cards use, without the DOM, so the tests can read them:
// the ids of design/reconstructions.md, whose short forms are the messages recon.R1, recon.R2 ...
// (the cards show those a program rests on; the README lists them all, and
// tests/app.test.js keeps the lists the same); the source repository; the system pack; and the
// references, the only other addresses the page names (tests/app.test.js, APP-3).

export const RECONSTRUCTIONS = Array.from({ length: 24 }, (_, i) => `R${i + 1}`);

/** The source repository. */
export const SOURCE_URL = "https://github.com/wixette/agt30-simulator";

/**
 * NCSU's system pack, M. Howard's dump (MH25), copied unchanged into packs/ from his repository at
 * this commit (packs/NOTICE): the page loads it from its own site, only when the operator boots
 * AMRMX or loads one of NCSU's games (U19).
 */
export const PACK_COMMIT = "235e2b43f1f4c7b52c9a15b94aba107d89e8522b";
export const PACK_URL = "./packs/howard.disk";
/** The games tape, from the same commit (packs/NOTICE): BROSE, whole, is on it. */
export const TAPE_URL = "./packs/games.tape";

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
