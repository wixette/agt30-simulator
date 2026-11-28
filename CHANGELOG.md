# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md), *Branches, versions and releases*). Versions 0.0.x are pre-releases. The decisions cited (D1, U8, R14, …) are in [docs/ui-design.md](docs/ui-design.md), [design/architecture.md](design/architecture.md) and [design/reconstructions.md](design/reconstructions.md).

## Unreleased

- **NCSU's system pack is in the repository** (`packs/`, with its NOTICE), copied unchanged from M. Howard's repository with his agreement, and credited as agreed with him: LIFE, Space War and AMRMX load from the simulator's own site, quickly, instead of from GitHub's raw files. It is historical software outside the repository's licenses ([docs/licensing.md](docs/licensing.md)).

- **BROSE draws roses**, NCSU's rose-curve program, from the Programs menu (`#program=brose`): restored whole from the lab's games tape, now in `packs/` beside the pack, and run as the lab ran it, a statement typed to AMRMX, `BROSE(7,500,3)!`. It pauses with the rose drawn until PULSE 1, as FORTRAN's PAUSE did; another rose is another statement. The Teletype now prints keys typed ahead as each is sent, after the prompt they answer.
- **Our 3-D tic-tac-toe is gone**: NCSU's own QUBIC takes its place, in the Programs menu and in the README's picture of the Screen. The light pen keeps its test (PRG-5), on the letter A; no program in the menu uses it until QUBIC's light pen is modeled.
- **QUBIC plays**, NCSU's 4 × 4 × 4 tic-tac-toe, from the Programs menu (`#program=qubic`): moves typed on the Teletype, the board drawn in three dimensions and turned by the dials. Getting it to run settled three things in the model (R1, R22): special instructions ignore their destination bits except for the conditional transfers and the arithmetic unit, whose multiply and divide take 'N, as NCSU's loader and QUBIC's rotations need; AVG1 has a three-dimensional mode, its lists pairs of a command and z, then x and y; and the array's runs take every word in turn, which also gives the matrix's layout from QUBIC's dials. AMRMX's characters now lean, from the slant it sets, as M. Howard remembers them. Our loader starts a game with AR clear.
- **PULSE 1 has its own row** at the top of the function keys in the console strip, as M. Howard recalls the box; the two foot pedals, which shared that row, are a group of their own, **Pedals**.
- **The foot pedals work in 3D** as the dials and keys do: press a treadle on the floor, or hold F1 or F2 in the strip, and the treadle tilts down in amber. Their card no longer says they have no control on the page.

## 0.0.6

The scope's phosphor is now the white one M. Howard remembers, and links to NCSU's games load reliably on a slow line.

- **The phosphor is white** (R14): a P7-like cool white flash with a long yellow-green afterglow, as M. Howard remembers NCSU's scope, in place of the P31-like green. Moving pictures leave a fading trail, and busy text is harder to read, as he recalls. The green is kept as `?phosphor=p31`.
- The pack's download gives up a stalled try after 20 seconds and tries three times, so a link to LIFE or Space War no longer waits for ever at "Fetching…" on a slow line (U19).
- LIFE's card no longer speaks of a zoom the Screen viewpoint does not have.
- `pnpm game-shots` (tools/game-shots.mjs) takes pictures of the panel, LIFE with a glider gun and Space War, for posts and letters.

## 0.0.5

The lab's own software runs. NCSU's monitor, AMRMX (1976), boots from M. Howard's dump of the lab's system pack, and two of its games, LIFE and Space War, play from the Programs menu. Getting there settled several of the processor's details from the lab's and Adage's own code.

**NCSU's software**
- **LIFE** and **Space War** in the Programs menu run unchanged from the pack under AMRMX, each with its card and link (`#program=life`, `#program=space-war`): Conway's Life on a 128 × 128 board, and the two-ship Space War with a foot pedal each for thrust (U19).
- **Boot AMRMX**, in the Panel tab, runs the monitor alone: it draws its banner on the scope with its own font, asks the date and takes statements typed on the Teletype (`LISTV(10)!` lists a volume). The pack (400 KB) is fetched from M. Howard's repository at a fixed commit, only when asked.
- For them, the vector generator and the array (R22), the Teletype's line (R23) and the disk (R24) are modeled at register level, from what DISP2, AMLD0 and the pack's programs show ([research/amrmx.md](research/amrmx.md)). The games are started by our own loader: AMRMX's statement for a core-image file is not on the surviving part of the pack.

**The processor**
- A store with 'O sets the word to −0, as every commented use in Adage's and NCSU's sources does; ARLS shifts through the sign as NORM does; the program interrupt's pivot is 77743; a priority service ends at its Jump Indirect only; a word sent to IR is the next instruction, so LIFE's 16,384-instruction chain runs (R1, R6, R10).
- The function keys and pedals reach S5 as Adage's switch routines read them: IC bit 9 selects keys 1–15, or the pedals and key 16 (R18). The strip has the two pedals.

**The installation**
- The Teletype is an ASR-35, the console desk AGTs used, at its documented size and in the shape photographs show (R17); the ASR-33 is kept as an option.
- The operator's control panel works, in a Panel tab and on the processor rack in 3D, with a Panel viewpoint: BR's lamp-buttons, the PRI switches, PULSE 1 (pressed again, it withdraws its request), RUN, HALT, PAUSE, STEP, CYCLE, RESET, ON and OFF, BTSP, IC 0 and IC 1 (R21).
- The Screen viewpoint's scope stays square in any window.
- The address bar keeps only the viewpoint, so a copied link opens the app as it starts; links with `#program=` made on purpose still work (U13).

**Also**
- The pack image is understood: the dump on tape is the pack's first 984 sectors, with the monitor and the games LIFE, QUBIC, Space War and BROSE ([research/ncsu-tapes.md](research/ncsu-tapes.md)).
- The overview: the array's size, a 19-inch rack of multiplying DACs (CCT21c); the function keys' layout.

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
