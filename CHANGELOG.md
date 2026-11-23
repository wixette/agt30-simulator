# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md), *Branches, versions and releases*). Versions 0.0.x are pre-releases. The decisions cited (D1, U8, R14, …) are in [docs/ui-design.md](docs/ui-design.md), [design/architecture.md](design/architecture.md) and [design/reconstructions.md](design/reconstructions.md).

## 0.0.4

The machine explained. A new document, written for engineers who know today's computers, explains the AGT-30 as a whole, so that what the simulator does, and what the manuals say, can be followed without the scans. It is shared now so that people who knew the machine can review it.

**The overview**
- [docs/agt30-overview.md](docs/agt30-overview.md): the AGT-30 for today's engineers, in ten sections and nine figures of our own: the machine at a glance, words and numbers, the DPR-2 processor, interrupts, the picture and the hybrid array, the input devices, the operator's panel and how the machine started, disks and tapes, the software, and what is known and what is not.
- Appendices: a glossary of Adage's names, every instruction with its code, the monitor's and DSPLY's statements and the picture items, and the sources.

**Also**
- The call with M. Howard of 2026-11-19 is summarized in [research/correspondence.md](research/correspondence.md): what he confirmed (PULSE 1's setting, PINT, booting with BTSP, the ASR-35, the phosphor's color, the disk), and the questions still open.
- US spelling throughout the documents and the page: color, center, license.

## 0.0.3

The simulator series' look, and phones. While the machine waits on M. Howard's answers, this release is about the page: it now looks and works like the series' other simulators (the Altair 8800 and the TRS-80), and it works on a phone.

**The look**
- The series' theme (U10): neutral grays round an amber primary, and the series' controls: top-bar tool buttons, tabs with icons, the segmented button (now also the Tube's time), fields, menus, tooltips, dialogs and the status line.
- The dock's handle is a row of its own, lit while dragged; dragging keeps the dock's foot where it is; the dock remembers its tab, height and fold (U1).
- The top bar keeps only the name, the tools and About: the tagline is gone, and its items share one center line.
- The Program tab's choices: the cards in a row are the same height.

**Phones** (P11, U2)
- The same app, packed down in steps; the console strip scrolls sideways; the notice that the page was made for a desktop is gone.
- The Tube on a phone: the overlays pack down to the top and the foot, the traces to a slim box, and the view is framed between them; the strip is left to the other viewpoints. The note and the traces let touches through to the 3D view, at every size.
- The Teletype's hint on empty paper sits under the date line, as wide as the paper in view.

**Finding your way**
- A way back (U17): the Programs menu ticks the program loaded and ends with Unload the program; the program card has Unload beside its title. Both reboot the terminal and show the list of programs again.
- About has References and Close buttons at its foot, as in the series; a new References tab lists the history, Adage's documents, M. Howard's tapes and documents, and the simulator's source and research (U16).

**Fixed**
- The Tube's traces sit just above the console strip, however tall it is; they had been partly covered.

## 0.0.2

The processor becomes the real DPR-2. Since v0.0.1, M. Howard's images of NCSU's tapes, with real ADEPT source and binaries, and Adage's own manual for the processor have come to light; the simulator now follows both, and a new tab shows the processor at work.

**The machine**
- The DPR-2 follows its manual (DPR2SPI; [research/dpr2-manual.md](research/dpr2-manual.md)), which the NCSU tapes bear out ([research/dpr2-encodings.md](research/dpr2-encodings.md)): the instruction layout and every code (R1, settled); AN and LS as defined, so −0 is negative and has lower significance; AS adding a sign-extended lower half to all of AR; 'F's operand the instruction itself; 'L, the operand in the next word; indirect chains, and 'X incrementing a word before it is read; JPSR keeping its word's upper half; the EAU's product and quotient as fractions, checked against the manual's examples (R6, settled); PINT on channel 14 (R10). The octal words in core are now the real machine's.
- A dial is read as on the AGT/30: GDD1 selects it, and the converter ADC5 puts it in S5 (R7).
- The assembler is ADEPT as its manual describes it (R8): macros, REPEAT and IREPEAT, conditional translation, STRING and ASCII, `.`, `$` externals, a space between terms as `+`, rotations, mnemonics as values, and the NCSU sources' instructions. All 34 routines of the NCSU tripp tape assemble to their binaries' words. TEXT fills only the words it needs.
- The monitor follows the 1971 AMRMX manual (R9): at start it asks the date, `MO/DA/YR = `, and the simulator answers it at once, so nothing waits on a new reader; it takes `V!`, `CORE!`, `DEC!`, `OCT!`, `MARK!` and `RLSE`, and answers `*` for an argument that does not evaluate.
- The programs' sources follow the real instruction set: a routine takes its arguments with `MDAR'I S`, then `MDAR'I'X S`, and returns with `JUMP'I'X S`; whole constants are loaded with 'L; loops count up, since 1 − 1 is −0.

**The page**
- A third dock tab, **Processor** (U15): the DPR-2's registers and interrupts, and core listed with the programs' symbols, read as instructions, display items or words; Go to an address or a symbol, places to go chosen from what runs and what is shown, and Follow, which keeps the processor's last instruction in view. It only looks. A view the real AGT never had.
- The dock starts at a share of the window's height, so the Teletype shows a dozen lines or more.
- The README is written for new users: a quick start, the machine's ideas beside the nearest thing today, and a guide to the page.

**Research and tools**
- Notes on the NCSU tapes, the DPR-2's block diagram and manual, and AMRMX on NCSU's system pack ([research/](research/)), and a log of our correspondence.
- `tools/amos-tape.mjs` reads the NCSU tape images; `tools/dpr2-pairs.mjs` pairs their source with their binaries; `tools/adept-check.mjs` assembles their sources and compares. The tapes themselves are not in the repository.
- `pnpm check` runs 113 tests, among them CPU-5 to CPU-10 and MON-5 to MON-6 for the above. The headless launcher never leaves Chrome running.

## 0.0.1

The first pre-release: small, honest about what it reconstructs, and good enough to show people who know the machine. It is public from the first commit, so nothing in it is there only to collect feedback (U12).

**The machine**
- One model in simulated time drives every view (D1, D2): the DPR-2 processor at instruction level, with its 30-bit one's-complement words and documented times; the hybrid array, x' = PS [D + SC (R x)], exact on its 15-bit inputs; the AVG1 vector generator; DSPLY walking the image every frame at 120 / (RATE + 1) a second, with ALL, CUT and BUMP; depth cueing, 10 : 1; the light pen and its hit table; the ASR-33 at 10 characters a second; the AMOS monitor and a subset of the ADEPT assembler.
- The DSPLY code tables are read from the manual's scan (DSPLY pp. 39-41); the instruction encodings, which no source found gives, are one table (R1). Everything else reconstructed is listed in the README and in [design/reconstructions.md](design/reconstructions.md), R1 to R20.

**Seven programs**, each typed on the Teletype by the Programs menu (U8): the letter A (FJCC68 Fig. 4); a cube turned by the dials (Fig. 7); a cube in perspective, its depth divided out by the processor and its rotation left to the array; the tunnel, with and without depth cueing (Figs. 15-16); a town from one house (p. 749); 3-D tic-tac-toe, after D. Ogden's game at NCSU, played with the light pen; and 1,000 random lines (Fig. 12), up to 4,000, when BUMP raises RATE and types it.

**The page**
- The installation in 3D, built from parameters with sizes measured from photographs or estimated (R16-R19): the desk and scope, the console's devices, the Teletype, four racks, two tape drives, two disk drives and the cables. Every part has a card and a close look.
- Four viewpoints, chosen from one menu: Room, Console, Screen (the picture close up, where the light pen works) and Tube (the scope cut open, the beam drawing in time slowed up to 100,000 times, with its X, Y and Z signals).
- The console strip: six dials, turned around their center or by small arrows; sixteen function keys and PULSE 1, in step with the desk in 3D; the light pen's state.
- The dock: the program's card, with its actions, a depth cueing switch, what is ours, its statements and source (with no program loaded, the list of programs to choose from); and the Teletype's paper and keyboard.
- The top bar: the Programs menu, its button naming the program loaded; Reboot; About.
- English only, every text a message (U11); desktop browsers only (U2).
- `?selftest` runs the acceptance checks in the page; `?phosphor=p4` or `p7` tries another phosphor (R14); `?debug` exposes the machine.

**Tools**
- `pnpm check` runs the reference check (forbidden names held only as digests), the strict JSDoc type check and 84 tests, among them the acceptance checks by area (WRD, IMG, ARR, VG, DSP, CRT, CPU, MON, ASM, TTY, PRG, SCN, APP).
- `pnpm shots` takes the release screenshots and the README's three pictures.
- CI runs the checks and REUSE on every push; GitHub Pages deploys `main` once they pass.
