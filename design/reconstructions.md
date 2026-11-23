# What the simulator reconstructs

Every place where the documents stop and we chose. Each entry gives four things:
- what the sources say;
- what the simulator does;
- why;
- what would settle it.

The README lists a short form of each entry, and each program's card those it rests on (U14 in [../docs/ui-design.md](../docs/ui-design.md)).

Sources are cited by key ([../research/bibliography.md](../research/bibliography.md)). **Status:** draft for v0.0.1, 2026-11-09. Ids are permanent: an entry that is settled stays here, marked *settled*, with what settled it.

## The processor and its software

**R1. The DPR-2's instruction encodings.** *Settled* (v0.0.2).
- *Sources:* the processor's manual gives the layout, the registers' numbers, the special instructions' codes and what each does (DPR2SPI pp. 19–46; [../research/dpr2-manual.md](../research/dpr2-manual.md)); ADEPT71 p. 41 lists the same codes. The routines on the NCSU tapes that survive as both source and binary show the same layout and codes (MH25; [../research/dpr2-encodings.md](../research/dpr2-encodings.md)), and so do AMRMX on the system pack ([../research/amrmx.md](../research/amrmx.md)) and M. Howard's disassembly (MH26).
- *We:* follow the manual: the layout (the instruction mode in bits 0–1, the destination in 2–5, the source in 6–8, rotation, logic, 'X, 'I); the codes; AN as AR[0] set and LS as AR[15–29] not +0, so that −0 is both; the conditional transfers; AS adding the operand's lower half, its sign extended, to all of AR; 'F's operand being the instruction itself; indirect chains, with 'X incrementing each word before it is read; JPSR keeping the upper half of the word it writes.

  Until v0.0.1 the layout and codes were ours. v0.0.2 first took them from the tapes, then from the manual: SKAN and SKLS are not DPR-2 instructions, and OPTY (00160) and OPTI (00460) had codes of ours that were wrong. Our programs' sources changed where the semantics did: 'X increments before the read, 'F gives the whole instruction, and −0 counts for LS.

**R2. DSPLY is JavaScript.**
- *Sources:* DSPLY was a DPR-2 program, defined item by item (DSPLY pp. 7–41); its code has not been found.
- *We:* interpret the format in JavaScript, and charge the documented processor time where it is documented. The estimates are: 12 µs a MOVE or DRAW item, 8 µs to dispatch any item, 3 µs an array register, 64 µs to save or restore a transform. With these, the documented vector counts per frame come out right.
- *Settled by:* a DSPLY listing.
- *Since v0.0.1:* no DSPLY is among the files cataloged on the NCSU tapes. DISP2, the AGT-10's display routine (1971), survives as source and binary, and the pack's system area has no DSPLY either. AMRMX's handler that puts text on the screen drives AVG1 from the DPR-2 through destinations 05, 06, 07 and 10 and the vector interrupts, as DSPLY would ([../research/ncsu-tapes.md](../research/ncsu-tapes.md), [../research/amrmx.md](../research/amrmx.md)).

**R3. Gaps in the image format.**
- *Sources:* the command word, opcodes, data types and address modes are documented to the bit (DSPLY pp. 12–41).
- *We chose three things:*
  - a word in an indirect chain marks itself with address mode I in its bits 12–14;
  - the structured mode's second word is an address with its own mode;
  - a 2D table's end-of-list word is itself a vector.
- *Settled by:* a DSPLY listing, or an image dump.

**R4. The programs are ours.**
- *Sources:* when v0.0.1 was written, we knew of no complete AGT program surviving in public. Volume I gives calling sequences and fragments only. Tapes from NCSU's AGT-30 were last reported unread (CCT20).
- *We:* every v0.0.1 program does a job the manuals describe, written the way the manuals write. Each program's card says what is ours:
  - the letter's proportions;
  - the tunnel's grid and proportions;
  - the house, the town, and the random lines;
  - the game, after D. Ogden's at NCSU (NCSU).
  
  RVCD (reading a dial) is Adage's routine name, with our code and calling sequence. RANDN, which ends Fig. 12's picture after NLINES lines, is ours.
- *Settled by:* the tapes, or any listing.
- *Since v0.0.1:* NCSU's programs survive: games as core images, more on a system pack, and the display part of 3-D tic-tac-toe as source (MH25; [../research/ncsu-tapes.md](../research/ncsu-tapes.md)). The v0.0.1 programs were written before we knew of them.

**R5. The array's analog error.**
- *Sources:* 15-bit inputs; settling to 0.01 % in 2 µs (SRM5 GHA4); "about once a year it had to be re-calibrated" (CCT20).
- *We:* quantize to 15 bits. Drift is modeled as a gain error of up to ± 1.2 % per multiplier and an offset of up to ± 0.4 % per row after a year, but it is not shown in v0.0.1.
- *Settled by:* calibration records, or the memories of people who did the calibration.

**R6. The EAU's product.** *Settled* (v0.0.2).
- *Sources:* the instructions and their times (SRM5 DPR3 p. 5); their results, with worked examples (DPR2SPI pp. 43–46).
- *We:* as the manual: a product of two 15-bit fractions in AR[0–28], AR[29] repeating its sign; a quotient in AR[15–29] and the remainder, in absolute value, in AR[0–14]. Five of the manual's examples are checked to the bit (CPU-9; [../research/dpr2-manual.md](../research/dpr2-manual.md)).
- *Until v0.0.2:* the product was the 30-bit integer product, and the quotient AR's whole value over the divisor.

**R7. Reading a dial.** *Mostly settled* (v0.0.2).
- *Sources:* on the AGT/30, selecting a multiplexer channel starts an analog-to-digital conversion, and CNVT starts one too (DPR2SPI p. 41); GDD1, destination 07, selects the array's input, and ADC5 converts it to S5[15–29], its overflow on sense line 29; the six dials are channel 1 of the inputs (DPR2BD; [../research/dpr2-block-diagram.md](../research/dpr2-block-diagram.md)).
- *We:* do so: RVCD sends the dial's number to destination 07 and reads S5. Ours: which bits of GDD1's word choose the input (we take the low four as its number); the conversion is done at once; the function switches in S5's upper half share bit 15 with the converter's sign.
- *Until v0.0.2:* the AGT/5's way (SRM5 GHA4): the dial compared with the array's X register, sense line 24, by successive approximation.
- *Settled by:* GDD1's documentation (the DPR2 Subsystem Programming Specification).

**R8. ADEPT.** *Mostly settled* (v0.0.2).
- *Sources:* the manual (ADEPT, Revision G); the NCSU sources and their binaries (MH25).
- *We implement:* what the manual describes for programs: statements, tags, comments, radix, decimal points, `+ − & * / //`, a space between terms as `+`, `!H !K !B` (rotations), `.`, `$` externals, LOC, OCTAL, DECIMAL, TEXT, STRING, ASCII, ENTRY, TITLE, EXPUNGE, ABSOLUTE, TERMINATE, `=`; string substitution: macros (MACRO, MACRO1, MACRO2, `"…"`, `\`, `%`), REPEAT, IREPEAT, IFZERO, IFNEGATIVE, IFPASS1, IFSAME, ELSE, ENDC, STOP; TYPEOUT, TYPEOCT, TYPEDEC; LINKAGE, from the NCSU sources; the DPR-2 mnemonics, and the display codes. The NCSU routines assemble to their binaries' words, all 34 of them ([../research/dpr2-encodings.md](../research/dpr2-encodings.md)).
- *We do not implement:* action operators (DEFINE), COMMON, TYPEIN, the `#` operators, relocatable output (externals resolve from the monitor's symbols, or are chained as a binary holds them, for the check).
- *Our own syntax:* how a display item's arguments are written (`DRAW (Z, X, Y)`); `'DIR` on an IRL argument; fractions written with a point (`.5`) and angles in degrees (`30DEG`).
- *Since v0.0.1:* TEXT fills only the words it needs, as the manual says; an image's two-word name is written `TEXT /A/; 0` where it is short.

**R9. What AMOS types.**
- *Sources:* the statements (DSPLY pp. 7–11; AMRMX); a later revision of the monitor's manual, with its messages (AMRMX71 pp. 11–13).
- *We:* type only echoes, results, `?` and `*`, with no prompt. At start the monitor asks the date, `MO/DA/YR = `, in the words AMRMX on the NCSU pack uses ([../research/amrmx.md](../research/amrmx.md)), and the simulator answers it with today's date at once, so that a new reader never waits on it. From AMRMX71 (since v0.0.2): `V!` (its version number, 5, is ours), `CORE!` and `CORE(ARG)!`, `DEC!` and `OCT!`, `MARK!` and `RLSE`, `*` for an argument that does not evaluate, and `?` for a symbol DELETE cannot find or bounds out of order. OPEN and LIST type a cell as AMRMX pp. 8–9 describe (its address in octal, a colon, its contents in the current MODE); the MODE at start is O, octal, our choice. RESET! returns core, the symbols, DSPLY's settings and the CLOCK chain to their state at start, which is how we read "logically equivalent to that immediately after loading the Monitor" (AMRMX p. 11).
- *The Teletype:* the real OPTY strobes BR[22] out to the Teletype a bit at a time, and the monitor takes the keyboard's bits from S4[14] under interrupts (DPR2SPI p. 43). Ours types a whole character from AR[24–29] and skips when the Teletype takes it, and the monitor reads the keyboard directly.
- *Settled by:* anyone who used the monitor; the DPR2 Subsystem Programming Specification for the Teletype's timing.

**R10. Interrupts.**
- *Sources:* the priority interrupt system (SRM5 DPR3 pp. 7–9).
- *We:* run PULSE 1 as the hardware did. The light pen, the Teletype and the frame clock are served by the simulator directly. (In v0.0.1 PULSE 1 is on the strip and the desk and goes down when pressed, but requests no interrupt: no program of v0.0.1 uses it, and the status line says so.)
- *Since v0.0.5:* PULSE 1, on the console and on the operator's panel, requests channel 1 with the PRI switches' instruction (R21).
- *Since v0.0.1:* the AGT-30's fifteen channels are known (PULSE 1 is 1, the Teletype 5, the frame clock 8, the light pen 10, AVG1 11; DPR2BD; MHN), and so are the pivots the software uses (77755 the frame clock, 77760 the light pen, 77776 PULSE 1, 77771 AR overflow; [../research/ncsu-tapes.md](../research/ncsu-tapes.md)). Not yet applied to the devices. Since v0.0.2 PINT requests channel 14, which executes `JPSR'I PIPVT` (DPR2SPI p. 40); the pivot's address, 77770, is ours.

**R11. The pen-hit table and PENHT.**
- *Sources:* DSPLY keeps "a circular table with 16 entries" of pen hits, and PENHT reads it (DSPLY p. 30).
- *We:* chose the table's layout: a count of hits, then two words per entry, at 77600 octal, named PHT. PENHT's code is ours.

**R12. Dash mode's spacing.**
- *Sources:* the mode is documented (DSPLY p. 28).
- *We:* draw about ten dashes an inch.

**R13. JavaScript stand-ins for two subroutines.**
- *Sources:* DSPLY's JSR item calls machine code.
- *We:* TUNSUB, which recomputes the tunnel's perspective for the viewer's place every frame (the array cannot divide), is JavaScript, charged an estimated 30 µs a point.

**R14. The phosphor.**
- *Sources:* the GDS1's phosphor is not documented (SRM5 GDS1).
- *We:* a green, medium-short, P31-like phosphor (τ = 1.5 ms), the usual choice for refreshed stroke displays. The face shows what an eye sums over about 33 ms, a whole number of frame periods when the picture refreshes at least that often. A P4-like or P7-like phosphor can be chosen with `?phosphor=` (a developer option; [../docs/development.md](../docs/development.md)).
- *Settled by:* anyone who saw the scope lit.

**R15. Core at start.**
- *We:*
  - The paper's pictures, DIALS, RVCD and the monitor's routines are in core when the terminal starts, as if loaded from disk.
  - The simulated machine has 32K words, as NCSU's had after its upgrade (NCSU); the standard AGT-30 had 8K (BRO69).
  - User programs are assembled after the pictures, from 40000 octal; the resident routines are at 60000, the monitor's work area at 67700.
- *Since v0.0.1:* the real monitor sits higher: AMLD0 enters it at 73400, its resident part starts at 74000, and the disk's pivots are 77720–77726 (MH25, MH26). Not yet applied.

## The installation in 3D

**R16. Sizes.**
- *Sources:* only the scope's usable picture is documented (12 × 12 in, SRM5 GDS1).
- *We:* measured the scope's cabinet from photographs of NCSU's (NCSU) and checked it against Adage's brochures (BRO68, BRO69): 545 × 635 × 870 mm, ± 6 %. The face's curvature (radius 1 m) and the tube inside (640 mm long) are typical of a 21-inch tube of the period. The desk follows the 1969 brochure's photograph. The racks, the tape drives and the disk drives are estimates from NCSU's photographs and the common sizes of the period. Each part's card gives its confidence.

**R17. The Teletype.**
- *Sources:* Adage's 1969 brochure lists an ASR-33 as the AGT-30's standard Teletype (BRO69). The Model 5 manual shows the heavy-duty ASR-35 (SRM5 DPR3 Figure 3), and M. Howard remembers AGTs using the ASR-35, rarely the ASR-33 (MH26). The ASR-35's overall size is documented: 38.5 in high, 40 in wide and 24 in deep, without the paper (TTY35). The two models print alike: 72 columns, 10 characters a second, upper case.
- *We:* show an ASR-35 at its documented size, its shape and the places of its parts measured on photographs of a Model 35 ASR from the front and the side (TTY35P): a console desk on two sled feet, the body overhanging the cabinet, its top sloping to the front edge; the tape tray and reader at the left, the printer's cover with the punch's window, the dome over the paper, the keyboard in the deck. The photographs were used as references only; none is in the repository. *(v0.0.5.)*
- *Also kept:* the ASR-33 on its stand, shown until v0.0.5, its parts' proportions measured from a third-party 3D model used only as a reference (Comugi's "Teletype ASR-33 (USA:1963)" in 3D Warehouse), scaled to its documented size (ASR33). A part's `model` in `params/terminal.json` chooses which is built, so either can be shown, or taken for another project.

**R18. The console's devices.**
- *Sources:* six dials (SRM5 VCD1); sixteen function keys and PULSE 1 (SRM5 FNS1); two foot pedals that act as function keys (SRM5 FNS1); a joystick (BRO69).
- *We:* read their boxes' shapes and places from NCSU's photographs. The pedals, never photographed, are drawn as the industrial foot switches of the period (confidence `design`).

**R19. The cables** are a diagram of the documented signal paths: one tube per link, routed on the floor, colored blue for digital words and orange for analog voltages. They are not the real cabling, which is undocumented. They glow with their traffic, a view the real AGT never had.

**R20. The cutaway and the beam.** The Tube viewpoint hides the cabinet's side, top and back. The beam is drawn straight from the yoke's deflection center to the spot, only while it draws: blanked, for a move or between frames, no electrons flow, and none is drawn; the Tube's note says which. A real beam is invisible and curves through the field. Both are views the real AGT never had.

**R21. The operator's control panel.**
- *Sources:* the panel's controls and what each does (SRM5 DPR3 pp. 12–14; figure 7 of [../docs/agt30-overview.md](../docs/agt30-overview.md)); the PRI switches' usual setting, 24000 77776, `MDIR 77776`, and PULSE 1 returning to the monitor (MH26).
- *We:* the panel works on the simulated machine, in the Panel tab and on the processor rack in 3D. Since this version's monitor is JavaScript, not code in core, what "the processor runs" means is the display's frames, the CLOCK chain, a foreground program, and the monitor answering the Teletype:
  - **HALT** stops all of them: no frame is drawn, so the picture fades; characters typed wait until **RUN**. **RUN** goes on from the next tick, without catching up the frames missed. **PAUSE** is HALT that still serves PULSE 1.
  - **STEP** obeys one instruction of a foreground program, or a waiting PULSE 1. **CYCLE**, one machine cycle, is the same here: the simulator works at instruction level.
  - **PULSE 1**'s pivot, 77776, holds `JUMP 67775`, a trap where the processor stops and the monitor takes over: the program stops and the display halts, as AMRMX's HALT! does to the display. Another instruction on the switches is obeyed as it is (`MDBR X` shows a word in BR, `BRMD X` stores BR's buttons); one that jumps while no program runs starts one there.
  - **RESET** clears AR, BR, IC, ER, LC and the interrupts, stops the program and the display, and halts; **RUN** then goes back to the monitor. **OFF** takes both buttons within two seconds; **ON** powers up in HALT with core kept.
  - **BTSP** sets PAUSE and IC bit 28, but no bootstrap tape is fitted yet. **TE** never lights, since the Teletype is served at once. The selector's **HUB 1** and **HUB 2** have nothing connected.
  - Both the Panel tab and the panel on the processor rack in 3D are drawn from one layout measured on the manual's photograph of the panel (SRM5 DPR3 Figure 4): its 2.9 : 1 proportions, a table of five columns in three rows, and the right-hand column. On the rack the panel's center is at 1.26 m, chest height for a standing operator, so every control is in reach and the lamps are read without looking up; where it sat on the real rack is not documented. In 3D each PRI switch is a lever, a short block, then a body tapering to its tip, narrower and thinner, standing straight out for 1 and pressed down 45 degrees for 0, as the photograph shows the usual setting; its controls take clicks in the Panel viewpoint only, where a click or a quick run of clicks on the panel never selects the rack, and the rack's double-click reframes the panel.
- *Settled by:* booting the real monitor from the pack (planned for v0.0.5), after which PULSE 1 and RUN act on AMRMX itself.
