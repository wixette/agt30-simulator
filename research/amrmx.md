# AMRMX on the system pack

What the binary of NCSU's operating system, AMRMX, shows about the DPR-2, as read from M. Howard's dump of his system pack (MH25, `magtapes/howard.disk`). Read on 2026-11-16 with our encodings ([dpr2-encodings.md](dpr2-encodings.md)) and disassembler (`disassemble` in `js/sim/dpr2.js`). The pack is studied and cited, not copied: no listing or word of it is kept here. Addresses are octal; disk positions are word indexes into the image, in decimal.

## Where it is

- **The image.** `howard.disk` holds the pack's 102,336 words, each in four bytes, low byte first. A cylinder is 1,664 words (16 sectors of 104).
- **The resident monitor.** Cylinder 2 (words 3,328–4,991) holds core 73400–76577, and the start of cylinder 3 holds 76600–77677: the two reads AMLD0 makes before it jumps to 73400 (ncsu-tapes.md). The words from 74000 are those of M. Howard's message (MH26).
- **The symbol table.** Cylinder 4, from word 6,656: 624 pairs, each a value then a five-character name. They agree with the labels in M. Howard's message. A value with an upper half names an overlay symbol: the upper half is the overlay's sector (its low nine bits, for the monitor's commands), the lower half the address.
- **The overlays.** The commands and most handlers are loaded when needed. A call is a `JPSR OVLDR` followed by a word giving the overlay's sector and its load address: 72524 for the monitor's commands (START, LOADA, GOTO, SNAP, …), 70000 for the handlers (tape, disk, card reader, punch, the display). Sector times 104 gives the overlay's place on the pack; every overlay found this way has its routines' entry words where the symbol table puts them.
- No routine on the pack is called DSPLY.
- **Its words.** Among the monitor's texts on the pack are the date prompt `MO/DA/YR = ` and `DATE ERROR.`, the AMRMX71 manual's messages as the program types them. The simulator's monitor asks the date in these words (R9).

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

## Running it (2026-11-23)

With the resident monitor in core at 73400–77677, as AMLD0 leaves it, and trial models of the disk controller and the Teletype's interface written from what AMLD0's source and the monitor's code expect, AMRMX runs on the simulator's DPR-2 from 73400, reads three overlays from the pack, and puts out its banner and the date prompt: `AMOS/2 DISK MONITOR`, `(PACK 000000000)`, `GENERATION : 21 APRIL 1976`, `CONFIGURATION :`, `MO/DA/YR =`. The models are a study harness, not yet part of the simulator. What they had to be:

- **DMS2, the disk** (channel 3). AMRMX puts a command word in 77720 and starts the controller by setting IC bit 5; S4 bit 5 is the controller ready. The command's upper half names the operation in its 07000 bits: 03000 seeks home; 02000 seeks by the number of cylinders times 16 in the lower half, toward cylinder 0 when bit 0 of the upper half (40000) is set; 06000 reads from the sector in the lower half (cylinder × 16 + sector, from the start of the pack). 04000, 05000 and 07000 are the other entries of the driver's table (a write and two not yet seen). 77721 holds the transfer: the word count above (bits 0–12), and the address before the first word below. On completion the controller writes a status word to 77722 (0 when all is well; in the upper half, 10 is a seek error, AMLD0 says) and requests service through a pivot: 77723 a transfer's normal end, 77724 an error, 77725 a seek's end, 77726 the end of a cylinder; 77727 also has a routine. The overlays read at start are the pack's sectors 130 (to 71252), 320 (to 72524) and 210 (to 70000, the display handler), 682 words each.
- **The Teletype's output** (channel 5). The monitor sets pivot 77750 to a routine that sends one bit, 77751 to the routine that ends a character, and enables a bit clock with IC bit 29. Each bit's routine puts the character, shifted, in BR and executes OPTY, which sends BR[22]: eight bits, the lowest first, each on its own interrupt, the eighth through 77751. What times the bits is not documented; the harness uses 110 baud. The keyboard's start bit has its own pivot, 77742 (not yet studied).
- **The program interrupt's pivot is 77743.** AMRMX keeps its task dispatcher there and queues work with PINT (R10). Before this the simulator's was a guess, 77770.
- **A priority service ends at its Jump Indirect.** The Model 5 manual says a Jump Subroutine service ends at "the first Jump Indirect instruction or successful conditional jump" (SRM5 DPR3 p. 8). AMRMX's interrupt routines and the tasks they queue take conditional jumps before returning; ended there, the next request is served inside them and an interrupted register is lost. AMRMX runs correctly only if the service ends at the Jump Indirect alone, and the simulator now does so (R10).
- **Where the console's text goes.** The monitor's output routine sends a character to the Teletype, unless the display handler is in the overlay area at 70000, in which case it hands the character to that handler, which draws it on the scope. At start the display handler is loaded, so the banner and the prompt go to the screen. Running that handler needs AVG1 at the level of its registers (destinations 05, 06, 07 and 10) and its end-of-vector and end-of-list interrupts (77756, 77757), which the simulator does not have yet.

## Still open

- **PINT.** Settled: a request on priority channel 14 ([dpr2-manual.md](dpr2-manual.md)), through the pivot at 77743 (above).
- **PULSE.** The resident monitor does not use it as an instruction.
- **Destination 07.** What GDD1 does with the words written to it (R7: v0.0.2 uses it only to choose a dial).
- **The display overlay in full,** and whether the games carry their own display code (R2, R4).
