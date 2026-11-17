# The DPR-2's manual

What Adage's own description of the DPR-2 settles. M. Howard added four documents to MH25 in November 2026: the processor's manual, *Digital Processor, DPR2: Subsystem Programming Instructions* (DPR2SPI, 1968–69), of which our block diagram (DPR2BD) is a page; a later ADEPT manual with the instruction codes and the format of relocatable files (ADEPT71); a later AMRMX manual (AMRMX71); and his own notes (MHN). The manual's figure of information flow is drawn for the AGT/30. Read on 2026-11-17 from the scans; nothing is copied here. Pages are the documents' printed page numbers.

## What it confirms

- **The layout** (DPR2SPI p. 20, Figure 5): M, the instruction mode, in bits 0–1 (0 special, 1 random address, 2 sequential, 'L; 3 immediate, 'F); D, the destination, 2–5; S, the source, 6–8; R, the rotation, 9–10 (none, 'B 1 bit, 'K 6, 'H 15, all left); T, the transfer logic, 11–12 (none, 'O, 'A, 'N); 'X 13; 'I 14; the address 15–29. As the NCSU tapes show ([dpr2-encodings.md](dpr2-encodings.md)).
- **The registers.** Sources: MD, AR, BR, IC, the sense lines S4, then S5–S7 for the subsystems. Destinations: MD, AR, BR, IC, IR, then 05–14 for the subsystems, and AS, AE and XO, 15–17 (p. 20).
- **The special instructions' codes** (p. 36, Figure 6), the same in ADEPT71 (p. 41): NOOP 00000, JPSR 00020, JUMP 00040, JSAN 00060, JPAN 00100, JSLS 00120, JPLS 00140, OPTY 00160, OPCR 00200, SKUA 00220, SKLA 00240, ANDD 00260, LSDD 00300, CNVT 00320, UPRI 00340, FPRI 00360, OPTI 00460, PINT 00560, OPIO 00600; the EAU's MPYU 15400, MPYL 15420, MPYI 15440, DIVU 16400, DIVL 16420, DIVI 16440, ARRS 17440, ARLS 17500, NORM 17520, ERAR 17540.
- **The conditions** (p. 37). AN, "AR negative", is true if AR[0] is 1; LS, "lower significance", if AR[15–29] is not +0. JSAN, JPAN, JSLS and JPLS are JPSR and JUMP under them.
- **Conditional transfers** (p. 38). ANDD and LSDD move the word at the address, unrotated, to the destination DD if the condition holds. The manual's examples: `ANXO MM`, with −0 in MM, takes AR's absolute value; `LSAS'N MM` counts down; `ANIR MM` executes the word at MM, as AMRMX does to return ([amrmx.md](amrmx.md)).

## What it corrects

Each of these is applied in v0.0.2, with an acceptance check (CPU-5 to CPU-10).

- **Codes.** OPTY is 00160 and OPCR, the card reader's strobe, 00200: the NCSU sources' PULSE is OPCR's code under another name. OPTI, 00460, strobes the telephone line interface, not the keyboard. CNVT, 00320, starts the converter. ADEPT71 also lists SKAN 00160 and SKLS 00200, which on the DPR-2 are OPTY's and OPCR's codes; they are not DPR-2 instructions. Our codes for SKAN, SKLS, OPTY and OPTI were wrong; JSLS's, 00120, was right.
- **LS and −0.** LS is true when AR's lower half is −0, 77777. Since 1 − 1 is −0 in one's complement, a loop that counts down to zero and tests with LS does not stop: our programs count up and compare instead.
- **AS** (pp. 24, 27). It takes the operand's lower half, extends its sign through the upper half, and adds the result to all of AR. AE adds all 30 bits; XO exclusive-ors them. The logic ('O, 'A) acts between the operand and AR before the operation.
- **'F** (pp. 19, 30). With no memory cycle, the operand is MD as fetched: the instruction itself, upper half and all (`MDBR'F BETA` puts `MDBR'F BETA` into BR). Only AS, which uses the lower half, or a test of the lower half, sees just the address field. Our programs now load whole constants with 'L, as the NCSU sources do.
- **Indirect addressing and the index** (pp. 32–33). Each word with 'I points to the next; at each level 'X increments the word about to be read, then it is read. So `MDAR'I'X S` steps S and then reads through it: a routine takes its first argument with `MDAR'I S`, the others with `MDAR'I'X S`, and returns with `JUMP'I'X S` (the manual's SURCH, pp. 50–53, does so).
- **JPSR** (p. 35) replaces only the address half of the word at A; its upper half, typically `JUMP`, stays, so `MDIR A` returns.
- **The EAU** (pp. 43–46). A product of two 15-bit fractions appears in AR[0–28], AR[29] repeating its sign: twice the integer product. A division of AR by a 15-bit divisor puts the quotient in AR[15–29] and the remainder, in absolute value, in AR[0–14]: the quotient is AR / (2 × divisor). Five of the manual's six examples fit to the bit. The sixth (DIVI) does not: its result is its dividend with the halves swapped, which looks like a misprint; and the MPYI example's first line has 25663 where its last has 24663, the value that fits.
- **PINT** (p. 40) requests priority channel 14, which executes `JPSR'I PIPVT`: a routine of a higher level asks for work at a lower one. MHN gives channel 14 to PINT too.
- **Reading a dial** (p. 41). "In the AGT/30 and AGT/50, Analog-to-Digital conversions are also triggered by the selection of a multiplexer channel": GDD1, destination 07, selects the input and the conversion lands in S5[15–29] (DPR2BD). CNVT starts one explicitly. Our dials are read so; the comparator, sense line 24, is gone.

## What is still ours

- **The Teletype.** OPTY "strobes BR[22] for serial output", and the input comes "using S4[14] and interrupts" (p. 43): the monitor sends and receives each character a bit at a time. What times the bits is not in the manual (it points to a *DPR2 Subsystem Programming Specification* we do not have). The simulator still types a whole character from AR on OPTY (R9).
- **Where PIPVT is.** The manual names the pivot but not its address; DPR2BD and the NCSU sources do not give it either. Ours is 77770 (R10).
- **GDD1's word.** Which bits of the word sent to destination 07 choose the group and line is not given; we take the low four bits as the input's number (R7).
- **The upper half of S5.** DPR2BD gives the function switches S5[0–14] and ADC5 S5[15–29]. FNS1 has sixteen keys; the simulator's key 15 shares bit 15 with the converter's sign.

## The other documents

- **ADEPT71** (Revision I, 1971) also gives the format of relocatable files (Appendix C, pp. 44–48): two-bit relocation codes, 00 absolute, 01 relocate to the program, 10 to the common block, 11 a special sub-code, read after rotating the word left one bit; and the sub-codes, among them 01 an entry, 02 an external reference and its chain, 05 a linkage, 11 a relative origin, 13 an absolute origin, 56 a monitor overlay (its disk sector and core origin, the descriptor found in AMRMX: [amrmx.md](amrmx.md)), and 60 the end of a program, which pads the last record. This settles what [dpr2-encodings.md](dpr2-encodings.md) left open about the binaries: the flags were read one bit out of step.
- **AMRMX71** (Revision J, 1971): the monitor's control statements, its messages (`?`, `*`, `REQD`, `MEMORY TOO FULL IN`, the date prompt `MO/DA/YR`, `STANDARD AMRMXn (REV. r, date)`) and its character codes. It bears on R9.
- **MHN**: M. Howard's tables of the IC register's bits, the sense lines, the fifteen priority channels and the sources and destinations, from his reading of the documents. It agrees with DPR2BD on the channels; it names destinations 05 and 06 for the array's XY and Z (DPR2BD also gives AVG1's flags and command there).
