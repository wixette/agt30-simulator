# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md), *Branches, versions and releases*). Versions 0.0.x are pre-releases. The decisions cited (D1, U8, R14, …) are in [docs/ui-design.md](docs/ui-design.md), [design/architecture.md](design/architecture.md) and [design/reconstructions.md](design/reconstructions.md).

## Unreleased

- The DPR-2's instruction encodings are now those of the NCSU tapes (R1; [research/dpr2-encodings.md](research/dpr2-encodings.md)): the layout, BR 2 and IC 3, destinations numbered in octal as the block diagram does, and the codes of the instructions the tapes show. Their octal words change. The processor also runs 'L, the operand in the next word.
- The assembler is ADEPT as its manual describes it (R8): macros, REPEAT and IREPEAT, conditional translation, STRING and ASCII, `.`, `$` externals, a space between terms as `+`, rotations, mnemonics as values, and the NCSU sources' instructions (conditional transfers, numbered destinations, 'L, PINT). All 34 routines of the tripp tape assemble to their binaries' words. TEXT now fills only the words it needs, so the programs write a short image name's second word.
- The processor follows its manual, which M. Howard found (DPR2SPI; [research/dpr2-manual.md](research/dpr2-manual.md)): the codes of the special instructions (OPTY, OPCR, CNVT, OPTI; SKAN and SKLS are gone); AN and LS as defined, so −0 is negative and has lower significance; AS adding a sign-extended lower half to all of AR; 'F's operand the instruction itself; indirect chains, and 'X incrementing a word before it is read; JPSR keeping its word's upper half; the EAU's product and quotient as fractions (R6); PINT on channel 14 (R10). The programs' sources follow: arguments are taken with `MDAR'I S`, then `MDAR'I'X S`, and a routine returns with `JUMP'I'X S`; whole constants are loaded with 'L; loops count up. A dial is read through GDD1 and the converter, ADC5 (R7). Six acceptance checks pin these (CPU-5 to CPU-10).
- A third dock tab, Processor (U15): the DPR-2's registers and interrupts, and core listed with the programs' symbols as instructions, display items or words, with Go to, places to go, and Follow. It only looks.
- The monitor asks the date at start, `MO/DA/YR = `, and the simulator answers it at once, so nothing waits on a new reader. From the 1971 monitor manual it also takes `V!`, `CORE!`, `DEC!`, `OCT!`, `MARK!` and `RLSE`, and answers `*` for an argument that does not evaluate (R9).
- `tools/amos-tape.mjs` reads the NCSU tape images; `tools/dpr2-pairs.mjs` pairs their source with their binaries; `tools/adept-check.mjs` assembles their sources and compares.
- The headless launcher never leaves Chrome running.

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
- The dock: the program's card, with its actions, a depth cueing switch, what is ours, its statements and source (with no program loaded, the list of programs to choose from); and the Teletype's paper and keyboard.
- The top bar: the Programs menu, its button naming the program loaded; Reboot; About.
- English only, every text a message (U11); desktop browsers only (U2).
- `?selftest` runs the acceptance checks in the page; `?phosphor=p4` or `p7` tries another phosphor (R14); `?debug` exposes the machine.

**Tools**
- `pnpm check` runs the reference check (forbidden names held only as digests), the strict JSDoc type check and 84 tests, among them the acceptance checks by area (WRD, IMG, ARR, VG, DSP, CRT, CPU, MON, ASM, TTY, PRG, SCN, APP).
- `pnpm shots` takes the release screenshots and the README's three pictures.
- CI runs the checks and REUSE on every push; GitHub Pages deploys `main` once they pass.
