# The DPR-2's instruction encodings

How the DPR-2 lays out an instruction, worked out from the NCSU tapes: the routines on the tripp tape that survive both as ADEPT source and as the binary the assembler made of it (MH25, `magtapes/tripp.tape`; [ncsu-tapes.md](ncsu-tapes.md)). This settles the layout that R1 reconstructed ([../design/reconstructions.md](../design/reconstructions.md)). Nothing from the tapes is copied here: the table below is what the pairs show, with a few examples.

Worked out on 2026-11-16. Bits are numbered as Adage numbers them, 0 the leftmost of 30; values are octal, as ADEPT writes them. An instruction's upper half (bits 0–14) is its operation; its lower half (15–29) its address or operand.

## How

- **The files.** A routine on the tripp tape is three files: its source (ATEXT), its binary (RELOC) and its symbols (RLSYM). `tools/amos-tape.mjs` reads the tape; the formats are in [ncsu-tapes.md](ncsu-tapes.md).
- **The binary.** Each record is the routine's name, a word of all ones, a word of relocation flags, the record's items, and a word of all ones. The first record starts with a pair for each entry point (01 and its address; its name). The last ends with a pair for each external (02 and an address where it is used; its name), then words marked 60, the first of which is the program's length. Between them are the program's words in order, from address 0. Since the routines start at 0, a word's address half is the value its source gives; an external's is 0.
- **The symbols.** The symbol table gives every label's address. Each label fixes where its statement sits, so a routine is paired from each label on, statement by statement, until a statement whose size is not certain (a string, a macro, a REPEAT).
- **The check.** A pair counts when its operand can be evaluated (a label of the routine, `.`, a number) and equals the word's address half. A statement with nothing to check, such as `FPRI`, counts when it lies in an unbroken run between pairs that do. Each instruction so paired is then checked against the layout below.
- **The tool.** `node tools/dpr2-pairs.mjs TAPE` does all of this and prints, for each routine, how many operands matched; then the forms that fit, and the pairs that do not.

This gives 1,398 instruction pairs from 30 routines, in 119 forms (a mnemonic and its modifiers). Of the 953 transfers among them, 938 fit the layout below exactly; in each of the other 15 the count has slipped by one word (an off-by-one, which the neighbouring word shows). Of the 445 other instructions, 439 fit; the six that do not are in AMLD0, FIDCH, ADCR and DPIIO, where the count slips, and no value among them recurs. ADCR, DPIIO and OPIOR pair poorly, and hold more pairs to be had.

## Transfers

| Bits | Field | Values |
|---|---|---|
| 0–1 | kind | 01 the operand is the word at the address; 11 'F, the address half is the operand; 10 'L, the operand is the next word; 00 not a transfer |
| 2–5 | destination | 0 MD, 1 AR, 2 BR, 3 IC, 4 IR, 15 AS, 16 AE, 17 XO; also 5, 7 and 10, which DISP2 names by number |
| 6–8 | source | 0 MD, 1 AR, 2 BR, 3 IC, 5 S5 |
| 9–10 | rotation | 00 none, 01 'B, 10 'K, 11 'H |
| 11–12 | logic | 00 none, 01 'O, 10 'A, 11 'N |
| 13 | 'X | |
| 14 | 'I | |

For example: MDAR 21000, ARMD 20100, MDAR'I'X 21003, MDAR'A 21010, MDAR'H'O 21064, MDAE'L 56000, ARXO'F 77100, S5AR'H'A'F 61570.

ADEPT numbers the registers in octal. DISP2 defines its own transfers by value, `MD05 = 25000!H`, `AR07 = 27100!H`, `MD10 = 30000!H` and `AR11 = 31100!H`, and uses MD10 to turn on the display clock and the vector generator: destination 10, which the block diagram calls D10 ([dpr2-block-diagram.md](dpr2-block-diagram.md)). The block diagram's numbers are octal too.

Not seen in a checked pair, but fixed by the layout: the source S4 (4), and forms such as ARBR'F (62100) and ICAR'F (61300).

## Other instructions

Bits 0–1 are 00. Bits 13 and 14 are 'X and 'I, as in a transfer (JUMP'I is 00041). The values seen, with the number of checked pairs:

| | | | |
|---|---|---|---|
| NOOP 00000 (9) | JPSR 00020 (112) | JUMP 00040 (160) | JSAN 00060 (4) |
| JPAN 00100 (34) | JPLS 00140 (55) | PULSE 00200 (1) | SKUA 00220 (1) |
| SKLA 00240 (1) | UPRI 00340 (3) | FPRI 00360 (3) | |

Conditional transfers keep a transfer's destination in bits 2–5: ANAR 01260 (6), ANIR 04260 (3), LSAR 01300 (2), LSIR 04300 (1), LSAS 15300 (1), LSAE 16300 (1).

The arithmetic unit's operations sit in its destinations, 15–17, in bits 2–5: ARRS 17440 (10), ARLS 17500 (10), NORM 17520 (1), ERAR 17540 (1), MPYI 15440 (2), DIVI 16440 (2).

Not seen on the tripp tape: JSLS, SKAN, SKLS, OPIO, the other multiplies and divides, PINT, the Teletype's instructions, and the modifier 'E.

## Compared with v0.0.1

| | v0.0.1 (R1) | The tapes |
|---|---|---|
| Transfer or not | bit 0 | bits 0–1, which also hold 'F and 'L |
| 'F | bit 1 | kind 11 |
| 'L | not in our subset | kind 10 |
| Source | bits 2–4 | bits 6–8 |
| Destination | bits 5–8 | bits 2–5 |
| Logic | bits 9–10: 'A 1, 'O 2, 'N 3 | bits 11–12: 'O 1, 'A 2, 'N 3 |
| Rotation | bits 11–12 | bits 9–10, the same codes |
| 'X, 'I | bits 13, 14 | the same |
| BR, IC | 3, 2 | 2, 3 |
| Other instructions | numbered by us | as above |

What the instructions do is not changed by this: only their octal words are, and the numbers of BR and IC. 'L is new.

Applied in v0.0.2 (`ENCODING` and `OPS` in `js/sim/dpr2.js`; the acceptance check CPU-4 pins the values above). The simulator also runs 'L, though its assembler does not yet accept it. The instructions the tapes do not show keep codes of ours: JSLS 00120, following JPSR and JSAN (a jump less 20); SKAN 00400, SKLS 00420, OPIO 00600, PINT 00620, the Teletype's OPTY 00640 and OPTI 00660; MPYU 15400, MPYL 15420, DIVU 16400, DIVL 16420.

## Compared with M. Howard's disassembly

His message showed the resident monitor as his disassembler reads it (MH26). Everything it showed agrees with the pairs: the kind in bits 0–1 (01 memory, 11 'F, 10 'L), the destination in bits 2–5, the source in bits 6–8, 'X in bit 13; JPSR 00020, FPRI 00360, MDAR 21000, ARMD 20100.

## Still open

- The relocation flags: two bits for each item, read from the left, but how the entry and external pairs take theirs is not yet clear. The words after the length, marked 60, are not understood. Neither is needed for the layout.
- The binaries of ADCR, DPIIO and OPIOR, as above. DPIIO's first records are not code but pairs of (05 and an address; a name), twelve to a record: perhaps the labels it defines for other routines. The pairing skips only the entry pairs (01), so its count starts wrong. AMLD0 has items marked 13. The relocation flags may say which items are code.
- What AN and LS test, and what 'B, 'K and 'H rotate by, which v0.0.1 reads its own way (R1).
- Instructions the tripp routines do not use: AMRMX on the system pack uses more of them.
