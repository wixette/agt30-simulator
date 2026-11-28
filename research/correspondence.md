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
- **2026-11-11.** We replied with times for a call.
- **2026-11-16.** We wrote again: no hurry for the call. We shared the tape catalog ([ncsu-tapes.md](ncsu-tapes.md)) and said we would work out the instruction encodings from the tripp tape's source/binary pairs and send him the results. MH25 states no license, so we asked whether he is comfortable with each of these:
  - citing facts from the tapes and his notes, with credit (as we do now);
  - adapting his tape and disk tools into this Apache-2.0 project;
  - one day including programs from the tapes, so that the page can run the original games.

  We suggested a license file in MH25 as the simplest way to cover the tools. We asked who else might hold rights in the programs, and how he would like to be credited. Two questions, if he knows offhand: does he have more DPR-2 documentation, Volume II of the Programmer's Reference Manual or an ADEPT manual; and where on the pack do AMRMX and its symbol table sit?
- **2026-11-16.** We sent the results, briefly: the encodings from the tripp tape agree with his disassembler; our assembler reproduces all 34 tripp routines; AMRMX and its symbol table are on the pack, and its display handler drives AVG1 from the DPR-2 ([dpr2-encodings.md](dpr2-encodings.md), [amrmx.md](amrmx.md)). We said that most of the analysis was done with an AI model (Claude), and that his memory is what checks it. Two questions: what destination 07 (GDD1) does with the words written to it, and whether the games drew through a system routine or their own code. The rest are below.

- **2026-11-17.** He replied that he had added documents to MH25 that answer some of our questions: the DPR2 processor's manual (DPR2SPI), later manuals of ADEPT (ADEPT71) and AMRMX (AMRMX71), and his notes (MHN). What they settle is in [dpr2-manual.md](dpr2-manual.md). A call is being arranged.
- **2026-11-19.** A video call of about an hour. He went through SRM5, DPR2BD, DPR2SPI and PRM1 on screen, with photographs from N. England's page and three color photographs of an AGT being brought up, which he believes were taken at Adage's factory. What he said, as it bears on the simulator:
  - **Use and credit.** We may use the code, binaries and documents in MH25 under any license; he wants them out in the world. He sees no copyright concern in Adage's code of the time, which carries no notice. Credit him for what he contributed, and Adage's authors by the initials at the head of their sources (HDK, and another like RPN; one author was a Nixon, likely R. J. Nixon of FJCC68).
  - **PULSE 1** is the operator's Ctrl-C: it aborts the program and returns to the monitor. It is a button on the Operator's Control Panel (OCP; SRM5 p. 12, Figure 4) and a single button by the function keys. It jams into the instruction register whatever the OCP's 30 PRI switches hold, normally 24000 77776, which decodes as `MDIR 77776`: execute the word at PULSE 1's pivot. One of the color photographs shows the switches set so. They were changed only to debug a machine (BR to AR, say).
  - **PINT** is the lowest-priority interrupt: a background task keeps it pending, and releasing it returns to the main-line program.
  - **The instruction set.** 'B, 'K and 'H rotate by a bit, a character and a half word; the 15-bit add was used mostly to modify (relocate) instructions. The transfer logic passes the operand straight, negated, ANDed or ORed "into the destination", for most destinations; our reading has it act with AR ([dpr2-manual.md](dpr2-manual.md)), to be checked. An endless indirect chain cannot be halted, only powered off (DPR2SPI p. 15 has no exit). 'I'X steps through an array.
  - **Booting.** The OCP's BTSP button reads an 80-word bootstrap, five tape frames a word, from the Teletype or a fast reader into core from 0; RUN at 0 then rolls the monitor in from the first cylinders of the pack (MONIT, PRM1 FILE I/O). NCSU added ROMs and a button that wrote the 80 words directly. No source or binary of the bootstrap survives; the monitor running shows as a banner of about two lines.
  - **The Teletype** on AGTs was usually an ASR-35, not an ASR-33 (SRM5 Figure 3: TTY1-P2, Model ASR-35).
  - **The phosphor** was "P7 or P30" as heard (perhaps P31): a cool white that decays towards green, with a very long afterglow. Text was uncomfortable to read beyond five or six lines; rooms were darkened to watch it. Characters were stroked in italics.
  - **The disk.** Each drive took two packs on one shaft, mounted together (he believes ICT's "twin disk"); a pack has two surfaces, 8 sectors of 104 words a track, 203 cylinders (PRM1 DSKIO). The seeks were loud and rhythmic, and he would like to hear them again. The dump leaves out the highest cylinders, which were scratch. NCSU ran donated drives of the same type.
  - **NCSU's machine.** Its own control panel, PULSE 1 box, function buttons and six dials (15-turn potentiometers); core replaced by 32K words of Fabri-Tek memory; a CalComp drum plotter, a card reader, a synchronous modem line, a Diablo printer, foot pedals; the Varian 620 and the Ambilog 200 (a 2 × 2 hybrid predecessor with tape only) beside it.
  - **The array** he describes as a 4 × 3 matrix multiplier with a perspective divide and Z intensity modulation, its converters of about 14 bits.
  - **Software that survives with him.** AMRMX only as the binary on the pack; ADEPT as a printed listing (it carries its own symbol table, hence EXPUNGE at the head of sources; he once retargeted it to a TMS9900); EDIT, the scope editor; the FORTRAN IV compiler and its libraries; QUBIC by D. Ogden for both the Ambilog and the AGT. The listings resist OCR. On the pack: LIFE (the simplest display, to run first), BROSE (a spirograph), Space War, a Lunar Lander that barely works, and an unfinished Pong. Whether the games drew through DSPLY or directly, he does not know. He has never seen a Volume II of the Programmer's Reference Manual.
  - **Next.** Boot the monitor from the pack image and look for its banner, then LIFE. He hopes to search the Computer History Museum's Adage folders for AGT material.
- **2026-11-23.** We thanked him and proposed a credit line; said we would change the Teletype to an ASR-35, correct the phosphor, add the OCP and boot from his pack; and asked for the color photographs' source and permission, a further document in his collection (ADAGE_SLS), his judgment of a side-by-side of our green and a P7-like white, and the three questions below that the call did not reach.
- **2026-11-27.** We sent v0.0.6: LIFE and Space War running unchanged from his pack under AMRMX, with links and how to play them, pictures of the panel and both games, and the scope now white with a green afterglow after his description. We asked whether the phosphor looks right, how a game was started under AMRMX, whether the rest of the pack survives, what set the Teletype's bit rate, and again about the photographs and the credit line; we said the store, the function keys and PIPVT had been settled from the sources.

- **2026-11-28.** He replied to v0.0.6. What he said, as it bears on the simulator:
  - **3-D tic-tac-toe.** The game, running correctly, shows a 4 × 4 × 4 board; he recalls no text legends on it. (Ours is 3 × 3 × 3 with a title.)
  - **The picture's size.** He would like a much larger display, and recalls NCSU's picture as about 15 × 15 inches (SRM5 GDS1 gives 12 × 12).
  - **The monitor on the scope.** After a boot, the scope showed a two-line message at its top, with words like "AMOS/2 Monitor", and a command prompt at its foot. PULSE 1 in a running program killed it and returned to that prompt.
  - **PULSE 1 on the console** sat on its own row, at the top of the function keys.
  - **Attribution.** We should acknowledge the programmers of whom there is no record. We take this, with the call of 2026-11-19, as his agreement to the credit line we proposed on 2026-11-23 and to our copying what the simulator needs from MH25 (decided 2026-11-28; [../docs/licensing.md](../docs/licensing.md)).
  - **The disk drives** should follow the 1969 brochure (BRO69). The packs had a brown oxide finish (their outer surfaces unused), and a rectangular plate with rounded corners showed the heads' position.
  - **The color photographs** are on bitsavers, in `pdf/adage/agt/george_clark_adage`; he does not know who George Clark was. They appear to be from Adage's plant.
  - **ADAGE_SLS** is Adage's *Software Limitations Summary*, a list of the known faults of its software; of little use to us.
  - **The phosphor.** The white looks better. The afterglow cannot be judged until the picture refreshes at the real hardware's lower rate.
  - **The Teletype.** The monitor's code should show what happens. He expects output on BR bit 22, the lowest bit first, an interrupt for each data bit (11 a second at 110 baud) and the software assembling the bits, perhaps with a sense bit marking a character's first bit. At NCSU nearly everything was typed on the console's external keyboard; the Teletype was rarely typed on, and printed tape listings.
  - **GDD1.** A word to it selects an analog input channel for the converter to sample.
  - **The pack's dump** holds the defined volumes only; the volume directory (cylinder 0, sector 0) lists them. No other tapes survive. Some program listings survive on paper.

## Open questions

Answers go above, with the date. Asked on 2026-11-23:

- **The phosphor (R14).** Is a P7-like white closer than our green, and how strong is the green afterglow? *(Answered 2026-11-28: the white looks better; the afterglow is to be judged at the real refresh rate, which is still open.)*
- **The Teletype's timing (R9).** OPTY sends each bit from BR[22] and input arrives on S4[14] (DPR2SPI p. 43): what sets the pace between bits? *(The pack shows a bit clock behind IC bit 29 that interrupts once a bit, through pivots 77750 and 77751: [amrmx.md](amrmx.md). Its rate is still the question.)* *(Answered in part 2026-11-28: his expectation matches the model; the Teletype was rarely typed on at NCSU.)*
- **GDD1 (R7).** What does destination 07 take in the word written to it (AMRMX's display handler writes full words)? *(Answered 2026-11-28: it selects the analog input to sample; the word's layout is still to be read from the code.)*
- **The program interrupt's pivot (R10).** Where is PIPVT? *(Since found on the pack: 77743, [amrmx.md](amrmx.md).)*
- **The color photographs.** Where are they from, and may we use them? And the document ADAGE_SLS. *(Answered 2026-11-28: bitsavers, the photographer unknown; ADAGE_SLS is a fault list.)*

- **The console on the scope.** AMRMX sends its text to the screen when its display handler is loaded. Was the scope the usual console at NCSU, with the Teletype for when the display was not in use? *(Answered 2026-11-28: yes, with the console's keyboard for input.)*

Asked again or newly on 2026-11-27: the phosphor (as it is now drawn), the Teletype's timing, the photographs, how a game was started (*The disk monitor's commands*, below; not answered on 2026-11-28) and the rest of the pack (below).

New, from his reply of 2026-11-28: the display's refresh rate on the real hardware, and whether NCSU's picture was 15 × 15 inches.

Not yet asked:

- **Depth cueing in QUBIC (R22).** Were QUBIC's far levels dimmer than the near ones? QUBIC loads the array's registers 21 and 22 (0.324 and 0.75), which change nothing in the simulator; if the far levels were dimmer, they may be the depth cue's settings. *(Added 2026-11-29.)*
- **QUBIC and the light pen.** Was QUBIC ever played with the light pen? Its display package records pen hits, but its own code reads moves from the Teletype. *(Added 2026-11-29.)*
- **QUBIC's dials.** Dial 3 sizes the board and 0–2 turn it; did dials 4 and 5 do anything? And D10 bit 14, which QUBIC sets and keeps?
- **The refresh rate and the picture's size** (from his reply of 2026-11-28): how often the real display refreshed, and whether NCSU's picture was 15 inches square rather than the manual's 12.

- **The rest of the pack.** The dump on tape ends after 123 records, the pack's first 61½ cylinders, with no tape mark: is there a second reel, or another copy of volumes 20–37 (the lunar lander, Pong)? *(Answered 2026-11-28: no other tapes survive. He reads the dump as holding the defined volumes; our reading of the directory, which lists volumes 20–37, is to be checked again.)*

- **The transfer logic.** Do 'A and 'O act on the operand and AR, or on the destination? *(Since settled for 'O by the sources themselves: a store to memory with 'O sets the word to −0, as every commented use on the tapes does ("SET BUSY FLAG", "SET DISK FLAG"); AMRMX then takes statements and LIFE redraws. Not sent; [amrmx.md](amrmx.md). Still open: does a store with 'A AND, as the manual says?)*
- **The disk monitor's commands.** How did an operator start a game under the 1976 AMRMX, for example LIFE? The 1971 manual's statements quote names (`S("TITLE", TAPE)!`); the pack's command table has START, LOAD, RETRIEVE, LISTF and others. Is there a manual of the disk monitor? *(Narrowed on 2026-11-27, not sent: AMRMX takes statements on the simulator, in the syntax NCSU's macros use (`START("9SE",10)!` loads and runs a relocatable file; `SYST(10)!` sets the volume). START only loads RELOC files. The question left: what statement restored a DUMP file such as LIFE, QUBIC or Space War? [amrmx.md](amrmx.md).)*
- **LIFE.** Its function keys, as its code reads them: 0 stop, 1 run, 2 load a figure from the pack, 3 save one, 5, 6, 9, 10 move the cursor, 7 set a cell, 11 clear one, 14 back to the monitor. Is that how it was played? Did a figure library exist on the pack?
- **Destinations 05 and 06.** The array's XY and Z (his notes), AVG1's flags and command (DPR2BD), or both?
- **The function keys.** How do sixteen keys fit S5[0–14]? *(Settled from the tripp library's own routines, not sent: IC bit 9 selects FNS 1–15, or the pedals and FNS 16; [amrmx.md](amrmx.md).)* And in ADCR's binary, what is the pair marked 00 (DTRR)?
- **The display (R2).** Was the display list walked by a DPR-2 program (DSPLY, as we read PRM1), or mostly by hardware?
- **The array (R5).** Does our model, x' = PS [D + SC (R x)], match what he knows? How was it calibrated?
- **Software.** Is 3DTTT D. Ogden's game, and where is `$TTT3D`? Who wrote the other games, and how were they played?
- **Credit.** Who else should be credited (the Computer History Museum; readtape; the program authors by name, once known)? *(2026-11-28: acknowledge the programmers of whom there is no record.)*
