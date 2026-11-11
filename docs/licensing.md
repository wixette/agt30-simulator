# Licensing and attribution

## Our own work

| What | Licence |
|---|---|
| Code: JavaScript, configuration, the ADEPT programs in `programs/` | **Apache-2.0** |
| Content: docs, design and research notes, `params/`, `research/data/`, the logo, the README's pictures | **CC BY-SA 4.0** |

The repository follows the [REUSE](https://reuse.software) specification. `REUSE.toml` sets these defaults and lists every third-party exception, and the licence texts are in `LICENSES/`. CI runs `reuse lint`.

## Third-party material

- **Vendored libraries** in `vendor/`, copied unchanged from npm together with their own `LICENSE` files:
  - three.js (MIT);
  - the Roboto Flex font (SIL Open Font License 1.1);
  - the Material Symbols icons (Apache-2.0). The page's icons are gathered into one module, as they are.
- **The Teletype's paper model** comes from the [Altair 8800 Simulator](https://github.com/wixette/8800-simulator) (Apache-2.0, the same author), adapted, and keeps its copyright line.
- **Adage's documents** (the 1968 paper, the brochures and the manuals) are cited, not copied. Facts and numbers taken from them are used with a citation. No page, figure or photograph from them is in the repository.
- **M. Howard's repository** of NCSU's tapes (MH25) states no licence. It is studied and cited: facts found in it (formats, file lists, addresses) are used with a citation, and no tape image, listing or tool from it is in the repository.
- **Photographs** (NCSU's, the brochures') were used as references for sizes only, and none is in the repository. A third-party 3D model of the ASR-33 was used the same way: it was measured, and no part of it is included (R17 in [../design/reconstructions.md](../design/reconstructions.md)).

Each third-party path gets its own annotation in `REUSE.toml`, and its licence text goes in `LICENSES/`.

## Credits

The README's **Credits** section and the About dialog list the sources the model relies on, the libraries, and the people whose published work the reconstructions rest on.
