# AMRMX on the system pack

What the binary of NCSU's operating system, AMRMX, shows about the DPR-2, as read from M. Howard's dump of his system pack (MH25, `magtapes/howard.disk`). Read on 2026-11-16 with our encodings ([dpr2-encodings.md](dpr2-encodings.md)) and disassembler (`disassemble` in `js/sim/dpr2.js`). The pack is studied and cited, not copied: no listing or word of it is kept here. Addresses are octal; disk positions are word indexes into the image, in decimal.

## Where it is

- **The image.** `howard.disk` holds the pack's 102,336 words, each in four bytes, low byte first. A cylinder is 1,664 words (16 sectors of 104).
- **The resident monitor.** Cylinder 2 (words 3,328–4,991) holds core 73400–76577, and the start of cylinder 3 holds 76600–77677: the two reads AMLD0 makes before it jumps to 73400 (ncsu-tapes.md). The words from 74000 are those of M. Howard's message (MH26).
- **The symbol table.** Cylinder 4, from word 6,656: 624 pairs, each a value then a five-character name. They agree with the labels in M. Howard's message. A value with an upper half names an overlay symbol: the upper half is the overlay's sector (its low nine bits, for the monitor's commands), the lower half the address.
- **The overlays.** The commands and most handlers are loaded when needed. A call is a `JPSR OVLDR` followed by a word giving the overlay's sector and its load address: 72524 for the monitor's commands (START, LOADA, GOTO, SNAP, …), 70000 for the handlers (tape, disk, card reader, punch, the display). Sector times 104 gives the overlay's place on the pack; every overlay found this way has its routines' entry words where the symbol table puts them.
- No routine on the pack is called DSPLY.

## What it settles

- **LS tests that AR's lower half is not zero, and a conditional transfer does not skip.** The Teletype handler turns a tab into a space with `MDXO'F 11`, then `LSXO` of a word holding 51, then `MDXO'F 40`. A tab leaves AR zero, so the transfer is not made and AR ends as 40, a space; any other character has 11, 51 and 40 XORed in (11 ⊕ 51 = 40), and comes out unchanged. This works only if the transfer is made when the lower half is not zero and the next instruction still runs. The carriage-return handler beside it tests in the same way. This is how v0.0.2 reads LS (R1).
- **IR as a destination runs the word as an instruction.** A subroutine's entry word holds the jump back, so `MDIR entry` returns, and the conditional `ANIR entry` and `LSIR entry` are a conditional return; the resident monitor uses them eight times. It also builds an instruction in AR and runs it with `ARIR'F`. The simulator already treats IR so.
- **'B then 'K rotates by 7.** The routine that turns an AMOS character into ASCII rotates a table word by 'B and then 'K once for each place, and keeps the low 7 bits. With 'B 1 and 'K 6, rotating left, the table gives the ASCII of all 64 AMOS characters but tab and carriage return, which are control codes; with 'K 15 it gives nothing sensible. This is how v0.0.1 reads 'B and 'K.
- **AN fits "AR negative".** `ANAR ZERO` clears AR when it is negative, before a test of its lower half; `MDAS'F'N 40` then `ANIR` returns when AR was below 40. It agrees with v0.0.2's reading, though no use found proves it.

## What it shows of the display

The handler overlay at sector 210 (INIDB, ISDCH, ISFAS, DSPWT, DSPL) puts the Teletype's text on the screen. Its display routine drives AVG1 itself, in the way PRM1 describes DSPLY, through the destinations the block diagram gives ([dpr2-block-diagram.md](dpr2-block-diagram.md)):

- destination 10, AVG1's mode and enable, is set with 'A and 'O masks, and STOPS clears its upper half to stop the display;
- destination 06, AVG1's command, is cleared by STOPS;
- XY (destination 5), AVG1's flags, and destination 07 (GDD1 on the diagram, our multiplexer MX) are written as each character is drawn; 07 takes full values such as 37777 and 21176, not only a 4-bit selection;
- the routine waits for the end-of-vector (77756) and end-of-list (77757) interrupts, setting their pivots as it goes.

STOPS, in the resident monitor, points the frame clock (77755), end-of-list and light pen (77760) pivots at an idle routine, and clears bits of IC. IC is the interrupt enable register: the Teletype and disk handlers set and clear its bits with 'O and 'A.

So at NCSU the display was run, at least for text, by a DPR-2 program, as R2 supposes. How the user programs' pictures were drawn (by the games' own code, or a routine like DSPLY in an overlay not yet read) is not known yet.

## Still open

- **PINT.** It comes just before the returns from the monitor's entry routine, which restore pivot 77771; what it does is not clear.
- **PULSE.** The resident monitor does not use it as an instruction.
- **Destination 07.** What GDD1 does with the words written to it (R7: v0.0.2 uses it only to choose a dial).
- **The display overlay in full,** and whether the games carry their own display code (R2, R4).
