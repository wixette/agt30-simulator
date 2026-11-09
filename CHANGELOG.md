# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md), *Branches, versions and releases*). Versions 0.0.x are pre-releases. The decisions cited (D1, U8, R14, …) are in [docs/ui-design.md](docs/ui-design.md), [design/architecture.md](design/architecture.md) and [design/reconstructions.md](design/reconstructions.md).

## 0.0.1

The first pre-release: small, honest about what it reconstructs, and good enough to show people who know the machine. It is public from the first commit, so nothing in it is there only to collect feedback (U12).

**The machine**
- One model in simulated time drives every view (D1, D2): the DPR-2 processor at instruction level, with its 30-bit one's-complement words and documented times; the hybrid array, x' = PS [D + SC (R x)], exact on its 15-bit inputs; the AVG1 vector generator; DSPLY walking the image every frame at 120 / (RATE + 1) a second, with ALL, CUT and BUMP; depth cueing, 10 : 1; the light pen and its hit table; the ASR-33 at 10 characters a second; the AMOS monitor and a subset of the ADEPT assembler.
- The DSPLY code tables are read from the manual's scan (DSPLY pp. 39-41); the instruction encodings, which no source found gives, are one table (R1). Everything else reconstructed is listed in the README and in [design/reconstructions.md](design/reconstructions.md), R1 to R20.

**Seven programs**, each typed on the Teletype by the Programs menu (U8): the letter A (FJCC68 Fig. 4); a cube turned by the dials (Fig. 7); a cube in perspective, its depth divided out by the processor and its rotation left to the array; the tunnel, with and without depth cueing (Figs. 15-16); a town from one house (p. 749); 3-D tic-tac-toe, after D. Ogden's game at NCSU, played with the light pen; and 1,000 random lines (Fig. 12), up to 4,000, when BUMP raises RATE and types it.

**The page**
- The installation in 3D, built from parameters with sizes measured from photographs or estimated (R16-R19): the desk and scope, the console's devices, the Teletype, four racks, two tape drives, two disk drives and the cables. Every part has a card and a close look.
- Four viewpoints, chosen from one menu: Room, Console, Screen (the picture close up, where the light pen works) and Tube (the scope cut open, the beam drawing in time slowed up to 100,000 times, with its X, Y and Z signals).
- The console strip: six dials, turned round their centre or by small arrows; sixteen function keys and PULSE 1, in step with the desk in 3D; the light pen's state.
- The dock: the program's card, with its actions, a depth cueing switch, what is ours, its statements and source; and the Teletype's paper and keyboard.
- English only, every text a message (U11); desktop browsers only (U2).
- `?selftest` runs the acceptance checks in the page; `?phosphor=p4` or `p7` tries another phosphor (R14); `?debug` exposes the machine.

**Tools**
- `pnpm check` runs the reference check (forbidden names held only as digests), the strict JSDoc type check and 84 tests, among them the acceptance checks by area (WRD, IMG, ARR, VG, DSP, CRT, CPU, MON, ASM, TTY, PRG, SCN, APP).
- `pnpm shots` takes the release screenshots and the README's picture.
- CI runs the checks and REUSE on every push; GitHub Pages deploys `main` once they pass.
