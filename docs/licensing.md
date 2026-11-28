# Licensing and attribution

## Our own work

| What | License |
|---|---|
| Code: JavaScript, configuration, the ADEPT programs in `programs/` | **Apache-2.0** |
| Content: docs, design and research notes, `params/`, `research/data/`, the logo, the README's pictures | **CC BY-SA 4.0** |

The repository follows the [REUSE](https://reuse.software) specification. `REUSE.toml` sets these defaults and lists every third-party exception, and the license texts are in `LICENSES/`. CI runs `reuse lint`.

## Third-party material

- **Vendored libraries** in `vendor/`, copied unchanged from npm together with their own `LICENSE` files:
  - three.js (MIT);
  - the Roboto Flex font (SIL Open Font License 1.1);
  - the Material Symbols icons (Apache-2.0). The page's icons are gathered into one module, as they are.
- **The Teletype's paper model** comes from the [Altair 8800 Simulator](https://github.com/wixette/8800-simulator) (Apache-2.0, the same author), adapted, and keeps its copyright line.
- **Adage's documents** (the 1968 paper, the brochures and the manuals) are cited, not copied. Facts and numbers taken from them are used with a citation. No page, figure or photograph from them is in the repository. The figures in `docs/overview/` are our own drawings, made from the manuals' descriptions and cited to them.
- **NCSU's system pack and games tape**, `packs/howard.disk` and `packs/games.tape`, are historical software: AMRMX and NCSU's games, by Adage, Inc. and the NCSU graphics lab. They are copied unchanged from M. Howard's repository of NCSU's tapes (MH25), with his permission (a call on 2026-11-19 and his message of 2026-11-28, [../research/correspondence.md](../research/correspondence.md)). Adage, Inc. ceased operations in 1994; no copyright holder has granted a license, and none is claimed. They are annotated `LicenseRef-HistoricalSoftware` in `REUSE.toml`, and [../packs/NOTICE](../packs/NOTICE) gives their sources, checksums and credit, and offers removal to a rights holder. More of MH25 may be copied the same way, into `packs/` with an entry in its NOTICE, when the simulator or a lesson needs it.
- **The rest of M. Howard's repository** (MH25), which states no license, is studied and cited: facts found in it (formats, file lists, addresses) are used with a citation. Our bootstrap and loader do what AMLD0 does without its code (R24).
- **Photographs** (NCSU's, the brochures') were used as references for sizes only, and none is in the repository. Photographs of a Teletype ASR-35 (TTY35P) and a third-party 3D model of the ASR-33 were used the same way: it was measured, and no part of it is included (R17 in [../design/reconstructions.md](../design/reconstructions.md)).

Each third-party path gets its own annotation in `REUSE.toml`, and its license text goes in `LICENSES/`.

## Credits

The README's **Sources and credits** section and the About dialog list the sources the model relies on, the libraries, and the people whose published work the reconstructions rest on. NCSU's software is credited in the words agreed with M. Howard: *The NCSU tapes and disk image: recovered by Marc Howard and read at the Computer History Museum (github.com/cramcram/AGT-30). The programs on them by Adage, Inc. and the NCSU graphics lab; authors credited by the initials in their sources*, with, at his wish, the programmers of whom no record survives. The same words are in [../packs/NOTICE](../packs/NOTICE).
