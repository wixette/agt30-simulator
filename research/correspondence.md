# Correspondence

What we have learned from people who knew the machine, and what they have allowed. Each entry is a summary: what was said, as it bears on the simulator. Messages are not reproduced, and no contact details are kept. Facts from here are cited as personal communications, by the keys in [bibliography.md](bibliography.md).

## N. England (NE26)

- **2026-11-05.** We wrote to thank him for his history of the NCSU lab (NCSU) and to ask about his photographs. He replied that we may use any of the photographs, credited to him and graphics-history.org, and introduced us to M. Howard, who has manuals and software of the AGT.
- **2026-11-10.** We sent the v0.0.1 pre-release.

## M. Howard (MH26)

- **2026-11-05.** We wrote to him, and again on N. England's introduction, asking what survives.
- **2026-11-10.** We sent the v0.0.1 pre-release.
- **2026-11-11.** He replied:
  - he has 7-track tapes from the NCSU lab, with listings and documents: about 70 % of the important system software, by his estimate. The tapes were read with the help of the Computer History Museum, which holds further Adage media;
  - his repository (MH25) has the tape images and his tools for Adage's tape and disk formats. The most useful tape is a dump of his system pack: it holds the binary of AMRMX and his games (Space War, Qubic, Life, BROSE, a lunar lander); the symbol table is elsewhere on the disk;
  - he has begun a disassembler (written with ChatGPT's help, not published), and his message shows the start of the resident monitor (74000 on) as it disassembles. Its mnemonics are not yet checked against Adage's documents, but the encodings it implies differ from ours (R1);
  - how the array and the display processor worked is the part he knows least, and he means to work it out;
  - he offers to fill in the assembler's syntax, the architecture and the instruction encodings, and suggested a call.

## Open questions

For the call with M. Howard. Answers go above, with the date.

- **Use and credit.** May facts and code from MH25 be used in this Apache-2.0 project, and how would he like it credited? Who else should be (the Computer History Museum; readtape)? Could the public page one day run the original programs, and who else might hold rights in them?
- **Encodings (R1).** Where does the disassembler's table of mnemonics come from? Does he have the whole DPR2 subsystem document of which DPR2BD is a page, or Volume II of the Programmer's Reference Manual? What do the modifiers 'F, 'L, 'X, 'I, 'A, 'O, 'N, 'B, 'K, 'H and 'E do?
- **Software.** Which programs survive as both source and binary? Are DSPLY, ADEPT or AMRMX on any tape as source? Is 3DTTT D. Ogden's game, and where is `$TTT3D`? Who wrote the games on the pack, and how were they played?
- **Starting the machine.** How was it booted: did AMLD0 come from paper tape, or from the switches?
- **The display (R2).** Was the display list run by a DPR-2 program (DSPLY, as we read PRM1), or mostly by hardware, as he remembers it?
- **The array (R5, R7).** Does our model, x' = PS [D + SC (R x)], match what he knows? Did NCSU's GHA2 read the dials through ADC5 (DPR2BD)? How was the array calibrated?
- **Use.** The phosphor's colour and persistence, and the flicker (R14); what AMOS typed (R9); how the light pen and PULSE 1 were used; NCSU's configuration (core, disks, tapes, keyboards).
