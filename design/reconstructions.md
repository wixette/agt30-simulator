# What the simulator reconstructs

Every place where the documents stop and we chose. Each entry gives four things:
- what the sources say;
- what the simulator does;
- why;
- what would settle it.

The README lists a short form of each entry, and each program's card those it rests on (U14 in [../docs/ui-design.md](../docs/ui-design.md)).

Sources are cited by key ([../research/bibliography.md](../research/bibliography.md)). **Status:** draft for v0.0.1, 2026-11-09. Ids are permanent: an entry that is settled stays here, marked *settled*, with what settled it.

## The processor and its software

**R1. The DPR-2's instruction encodings.**
- *Sources:* every mnemonic (ADEPT App. B); the meanings and times of most (the AGT/5's DPR3, SRM5 DPR3 pp. 1–14); the split of the word into 13 + 2 + 15 bits (SRM5 DPR3 p. 4); the AGT/5's source and destination numbers (SRM5 Table 1). No document found gives a single instruction's octal value. Volume II of the Programmer's Reference Manual (hardware) has not been found.
- *We:* place the fields ourselves, in one table:
  - bit 0 says transfer or not; then F, source (3 bits), destination (4), logic (2), rotation (2); X is bit 13, I bit 14;
  - we number the non-transfer operations;
  - we read the modifiers our way: 'A, 'O and 'N act on the destination; 'B, 'K and 'H rotate by 1, 6 and 15 bits; 'X steps the lower half of the word read.
  
  A program's source is the same as on a real DPR-2; its octal words are not.
- *Settled by:* any octal listing beside its ADEPT source; Volume II; the DPR-2 subsystem documents that Volume I cites.
- *Since v0.0.1:* the NCSU tapes hold about thirty routines as both source and binary, and M. Howard's disassembly of the resident monitor shows encodings unlike ours (MH25, MH26; [../research/ncsu-tapes.md](../research/ncsu-tapes.md)). The AGT-30's own source and destination numbers differ from the AGT/5's in places: BR is 2 and IC 3, for one (DPR2BD; [../research/dpr2-block-diagram.md](../research/dpr2-block-diagram.md)). Not yet applied.

**R2. DSPLY is JavaScript.**
- *Sources:* DSPLY was a DPR-2 program, defined item by item (DSPLY pp. 7–41); its code has not been found.
- *We:* interpret the format in JavaScript, and charge the documented processor time where it is documented. The estimates are: 12 µs a MOVE or DRAW item, 8 µs to dispatch any item, 3 µs an array register, 64 µs to save or restore a transform. With these, the documented vector counts per frame come out right.
- *Settled by:* a DSPLY listing.
- *Since v0.0.1:* no DSPLY is among the files catalogued on the NCSU tapes. DISP2, the AGT-10's display routine (1971), survives as source and binary, and the pack's system area is not yet examined ([../research/ncsu-tapes.md](../research/ncsu-tapes.md)).

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
- *We:* quantise to 15 bits. Drift is modelled as a gain error of up to ± 1.2 % per multiplier and an offset of up to ± 0.4 % per row after a year, but it is not shown in v0.0.1.
- *Settled by:* calibration records, or the memories of people who did the calibration.

**R6. The EAU's product** is the 30-bit integer product of two 15-bit numbers (shift left one for fractions).
- *Sources:* the instructions and their times (SRM5 DPR3 p. 5).

**R7. Reading a dial.**
- *Sources:* the array's multiplexer and comparator make an AD converter, read by successive approximation (SRM5 GHA4).
- *We:* compare the multiplexed voltage with the X data register directly, not with the array's transformed output. The program sees the same result.
- *Since v0.0.1:* on the AGT-30, a selector (GDD1) chooses the input and a converter (ADC5) reads it to S5; the six dials are channel 1 of the array's inputs (DPR2BD; [../research/dpr2-block-diagram.md](../research/dpr2-block-diagram.md)). Not yet applied.

**R8. The ADEPT subset.**
- *We implement:* statements, tags, comments, radix, decimal points, `+ − & * /`, `!H !K !B`, LOC, OCTAL, DECIMAL, TEXT, ENTRY, TITLE, TERMINATE, `=`, REPEAT/ENDR, the DPR-2 mnemonics, and the display codes.
- *We do not implement:* macros, conditional assembly, action operators, relocation.
- *Our own syntax:* how a display item's arguments are written (`DRAW (Z, X, Y)`); `'DIR` on an IRL argument; fractions written with a point (`.5`) and angles in degrees (`30DEG`).
- *Since v0.0.1:* the real sources show what the subset lacks: `EXPUNGE`, `ABSOLUTE`, `STRING`, `$` externals, conditional assembly ([../research/ncsu-tapes.md](../research/ncsu-tapes.md)).

**R9. What AMOS types.**
- *Sources:* the statements (DSPLY pp. 7–11; AMRMX).
- *We:* type only echoes, results and `?`, with no prompt. OPEN and LIST type a cell as AMRMX pp. 8–9 describe (its address in octal, a colon, its contents in the current MODE); the MODE at start is O, octal, our choice. RESET! returns core, the symbols, DSPLY's settings and the CLOCK chain to their state at start, which is how we read "logically equivalent to that immediately after loading the Monitor" (AMRMX p. 11).
- *Settled by:* anyone who used the monitor.

**R10. Interrupts.**
- *Sources:* the priority interrupt system (SRM5 DPR3 pp. 7–9).
- *We:* run PULSE 1 as the hardware did. The light pen, the Teletype and the frame clock are served by the simulator directly. (In v0.0.1 PULSE 1 is on the strip and the desk and goes down when pressed, but requests no interrupt: no program of v0.0.1 uses it, and the status line says so.)
- *Since v0.0.1:* the AGT-30's fifteen channels are known (PULSE 1 is 1, the Teletype 5, the frame clock 8, the light pen 10, AVG1 11; DPR2BD), and so are the pivots the software uses (77755 the frame clock, 77760 the light pen, 77776 PULSE 1; [../research/ncsu-tapes.md](../research/ncsu-tapes.md)). Not yet applied.

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

**R17. The Teletype's shape.**
- *Sources:* the ASR-33's overall size (22 × 18.5 × 34 in on its stand) is documented.
- *We:* took the proportions of its parts from measurements of a third-party 3D model, Comugi's "Teletype ASR-33 (USA:1963)" in 3D Warehouse, scaled to that size. The model was used as a reference only, and no part of it is included.

**R18. The console's devices.**
- *Sources:* six dials (SRM5 VCD1); sixteen function keys and PULSE 1 (SRM5 FNS1); two foot pedals that act as function keys (SRM5 FNS1); a joystick (BRO69).
- *We:* read their boxes' shapes and places from NCSU's photographs. The pedals, never photographed, are drawn as the industrial foot switches of the period (confidence `design`).

**R19. The cables** are a diagram of the documented signal paths: one tube per link, routed on the floor, coloured blue for digital words and orange for analog voltages. They are not the real cabling, which is undocumented. They glow with their traffic, a view the real AGT never had.

**R20. The cutaway and the beam.** The Tube viewpoint hides the cabinet's side, top and back. The beam is drawn straight from the yoke's deflection centre to the spot, only while it draws: blanked, for a move or between frames, no electrons flow, and none is drawn; the Tube's note says which. A real beam is invisible and curves through the field. Both are views the real AGT never had.
