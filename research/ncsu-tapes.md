# The NCSU tapes

What survives of the software of NCSU's AGT-30, as far as we have catalogued it. M. Howard kept 7-track tapes from the lab; they were read at the Computer History Museum in 2022 with L. Shustek's readtape (556 BPI, NRZI), and he published the images with tools for Adage's tape and disk formats (MH25). This page lists what is on them and what each find could settle. The images are cited by their path in MH25; none is copied here, and nothing in the simulator uses them yet.

Catalogued on 2026-11-11 by reading the tape headers and the pack's volume directory with the formats below. File numbers are octal, as AMOS numbers them; lengths are in 30-bit words.

## The formats

- **Tape records.** Each record starts with four words: the record and file numbers (15 bits each); the file's name (five 6-bit characters); the date (year from 1964, month, day) and the record's length; and the file's type, version, revision and origin. A one's-complement checksum follows the data.
- **File types.** SYMS, DATA, RELOC (relocatable binary), ASCII, TEXT, RLSYM (its symbols), PRNTR, ATEXT (ADEPT source in 6-bit characters, five a word), BIN, DUMP (a core image), DISK, MACRO.
- **The disk pack.** 104-word sectors; 8 sectors on each of 2 surfaces make a cylinder; 203 cylinders. A volume directory at the start of the pack names the volumes and the files in each.

## What is on them

| Tape (MH25 `magtapes/`) | Written | What it holds |
|---|---|---|
| `tripp_master_library` (`tripp.tape`) | 1970–71 | A library of 31 routines, most as source (ATEXT), relocatable binary (RELOC) and symbols (RLSYM) together: see below |
| `games_1975jan` (`games.tape`) | 1969–75 | QUBIC, LIFE, BROSE and SPCWR (Space War) as core images (DUMP); the display part of 3-D tic-tac-toe (3DTTT, source, October 1971); BCOR and CDAF (source); 9SE (binary); a test file; the set is written twice. The last record is damaged |
| `agt_text_tape_13Jan76` (`agt.tape`) | Dec 1975 | Adage's Extended FORTRAN IV compiler for AMOS/2 disk systems, in six source files (FTN01–FTN06, rev. D, 1 January 1973) |
| `556_howard_sys_pack` (`howard.tape`, `howard.disk`) | Apr 1976 | One file, HPACK: a dump of the whole system pack, 102,336 words |

**The tripp library.** Source with binary: AMLD0 (the monitor loader for disk unit 0, a modification of Henry Kerr's, November 1970), FIDCH (file ID change), ADCR (two versions), DTDHR (disk and tape data handling), SECFH, DTLST, FACTC, FSRR, FPRR, ANKRR, ARJR, CCJR, FSJR, FPJR, ANKJR, OPIOR, DSKWT (disk wait), 4VDCK, 4OMEM (two versions; the empty disk volumes as virtual memory), UPDHR, 4NDEC (decimal input), 4SPLU, DPIIO (the DPI1 data phone interface), DISP2, LOADS, RCD26 (two versions), 4SAT, INDEC, 4DFCR, 4PKRN, RCD (the card reader).

**The system pack.** Cylinders 34 onward hold five user volumes (octal numbers):

| Volume | Files (as the directory names them) |
|---|---|
| 10 | QUBIC, LIFE, SPCWR, BCOR, CDAF, 9SE, BROSE, LSECO |
| 20 | CNFG, LUNAR, SPIRA, SINED, GRID, FTN02, PRNTR |
| 30 | MGRAF, GRAFX, LANDR, LABUL, LUNER, and dozens of routines whose names suggest an aircraft simulation (ACSIM, AERO, ATMOS, PILOT, TRIM, ACTUA, …) |
| 35 | DCOR, DCAF, PFONT, ALPHA, BETA, RPLOT, RECT, AND, OR, and more of the simulation |
| 37 | OPER, PONG |

The cylinders before 34 are not in the volume directory. The pack holds the binary of the operating system, AMRMX, and its symbol table (MH26); M. Howard's message shows the resident monitor, from 74000, as his unpublished disassembler reads it (MH26).

## What each find bears on

The R numbers are those of [../design/reconstructions.md](../design/reconstructions.md).

- **R1, the instruction encodings.** Every source in the tripp library sits beside its binary: about thirty pairs to check a layout against. The disassembly in M. Howard's message (MH26) implies encodings that differ from ours; its mnemonics come from an unpublished disassembler and are unverified. The pairs can settle the question without it.
- **R2 and R3, DSPLY and the image format.** No DSPLY is in the listings above. DISP2 is "Display routine for AGT10/AVG1" (C. N. Carter, March 1971): the AGT-10's, which had no array, but it drives the AVG1 vector generator and names its interrupt pivots. Whether DSPLY is in the pack's system area is not known yet.
- **R4, the programs.** Real programs of NCSU's AGT-30 survive: the games as core images, and more on the pack. 3DTTT is source, but only the display part; it calls the game itself as `$TTT3D`, which is not among the files catalogued here.
- **R8, ADEPT.** The sources use what our subset lacks: `EXPUNGE`, `ABSOLUTE`, `ENTRY A,B`, `STRING'…'`, `$NAME` for an external, `.` and `.+2`, `!H!B!B`, conditional assembly (`IFPASS1`, `IFZERO`, `ELSE`, `ENDC`), and `TYPEIN` / `TYPEOUT`. Subroutines start with a `JUMP .` or `JUMP 0` word and take their arguments in the words after the `JPSR`.
- **R10 and R15, interrupts and core.** The sources name the interrupt pivots: 77755 the frame clock, 77756 end of vector, 77757 end of list, 77760 the light pen, 77771 overflow (DISP2); 77776 PULSE 1 and 77720–77726 the disk (AMLD0). AMLD0 reads the monitor from the pack and enters it at 73400. See also [dpr2-block-diagram.md](dpr2-block-diagram.md).

Open questions about the tapes are in [correspondence.md](correspondence.md).
