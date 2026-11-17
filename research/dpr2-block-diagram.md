# The DPR-2 block diagram

A transcription of one page of Adage's "Processor, DPR2 — Subsystem Programming Instructions": the block diagram of an AGT with every subsystem, the processor's sources and destinations, and the priority interrupt channels. M. Howard published a scan of it (MH25, `doc/AGT_Architecture.pdf`; key DPR2BD). It is the only page we have of the DPR-2 documents that the Programmer's Reference Manual cites, and it describes the AGT-30's processor where SRM5 describes the AGT/5's DPR3. The page is not copied here.

Read on 2026-11-11 from the 300 dpi scan, and corrected on 2026-11-16. Bit numbers are Adage's, 0 the leftmost of 30. The numbers of sources, destinations and special instructions are octal, as in ADEPT (C0–C37; the EAU's D15–D17 are the encodings' 13–15 decimal, [dpr2-encodings.md](dpr2-encodings.md)); the channels are decimal. The drawing writes zero as Ø. "As we read it" marks lines the drawing leaves open to another reading.

## Priority interrupt channels

| Channel | Device | Channel | Device |
|---|---|---|---|
| 0 | EAU1, the arithmetic unit | 8 | DCL, the frame clock (from AVG1) |
| 1 | PULSE 1 | 9 | HWD1, the hardware window |
| 2 | MTP / DDC, the tapes | 10 | LPN1 / DCM1, the light pen |
| 3 | DMS2, the disk | 11 | AVG1, the vector generator |
| 4 | COM, communications | 12 | LCG1, the character generator |
| 5 | TTY, the Teletype | 13 | PRP1, the paper tape |
| 6 | ANK2, the keyboards | 14 | PINT, the programmed interrupt |
| 7 | CDR1, the card reader | | |

The line printer's channel is "unassigned". Each device gives its priority instruction word (PIW) on source S8.

## Sources and destinations

| Number (octal) | Source | Destination |
|---|---|---|
| 0 | DME1, memory (S0) | DME1, memory (D0) |
| 1 | EAU1 (S1) | EAU1 (D1) |
| 2 | BR | BR |
| 3 | IC | IC |
| 4 | the sense lines (S4) | "(;R)", as we read it IR |
| 5 | GAI1, the switches and keyboards [0–14]; ADC5, the converter [15–29] | X data [0–14], Y data [15–29], to the array; AVG1 flags F1, F2 [14, 29] |
| 6 | DDC1, tape data | Z data [15–29], to the array; AVG1 command [0–14] |
| 7 | DMS2, disk data | GDD1, the array's input selector |
| 10 | | AVG1 mode and enable [0–13]; GAI1, the function switch lights [14–29] |
| 12 | | LPR2, the printer |
| 13 | | DDC1, tape data |
| 14 | | DMS2, disk data |
| 15, 16, 17 | | EAU1 |

The priority instruction word is drawn as "S8 [0–29]", which is not an octal number: it does not come through the source field, as we read it.

Special instructions C0–C37 strobe the devices (C7 the Teletype, C10 the card reader, C20–C26 the EAU, C23 communications, C30 the paper tape).

**Sense lines (S4).** 3, 4 the printer online and in error; 5 the disk ready; 6, 7 the card reader ready and in error; 8, 9 busy and print in progress (a hard-copy unit only); 10 the tablet's pressure switch; 11, 12 and 25–28 window hits (HWD1); 13, 14 the Teletype; 15 communications busy; 16–21 the tapes; 29 ADC5 overflow.

## The array's inputs (GHA2)

GHA2 holds the array (HAY1), its input selector (GDD1) and a converter (ADC5).

- HAY1 takes X, Y and Z data from D5 and D6, and gives X, Y and Z'M to AVG1.
- Its analog inputs come in three channels of eight lines, [22]–[29]:
  - channel 0: [27]–[29] the array's own outputs looped back, as we read it; [26] spare; [23]–[25] the joystick's X, Y and Z (JSB1); [22] the tablet's stylus (ADT1);
  - channel 1: [24]–[29] the six dials, VCDA to VCDF (VCD1); [22], [23] spare;
  - channel 2: optional spares.
- GDD1, loaded from D7 under IC bit 10, sets the group, channel, data value and reset lines of HAY1, and triggers ADC5.
- ADC5 converts HAY1's analog output: triggered (also by "00320"), its result is S5 [15–29], its overflow S4 bit 29.

## The display

- AVG1 takes its flags from D5 [14, 29], its command from D6 [0–14], its mode and enable from D10 [0–13], and a 2 MHz clock. It raises channels 8 (the frame clock), 10 (the light pen) and 11.
- Up to four light pens (LPN1 #1–#4) feed AVG1.
- Scopes: GDS1, and AVS1,2 #1–#3 (or a GDR2 hard-copy unit).
- GAI1 serves up to four keyboards (ANK2, channel 6), the function switches and their lights (FNS1), and a remote PULSE 1.

## Compared with the simulator

v0.0.1 took its numbers from the AGT/5 (SRM5 Table 1). Where the diagram differs:

v0.0.1 numbers its destinations in decimal; the diagram's are converted here.

| | v0.0.1 | The diagram |
|---|---|---|
| BR and IC | IC 2, BR 3 | BR 2, IC 3 |
| Destinations 7, 8, 9 | X0, CT, MX (the multiplexer) | GDD1 (D7), AVG1 mode and the lights (D10), none drawn (D11) |
| Destinations 10, 11, 12 | LP, none, HS | the printer, tape and disk (D12–D14) |
| Destinations 13, 14, 15 | AS (add 15 bits), AE (add 30 bits), XO | EAU1 (D15–D17), as ours |
| Reading a dial (R7) | the array's comparator against the X register, sense bit 24, by successive approximation | GDD1 selects the input, ADC5 converts it to S5 |
| Interrupts (R10) | no numbered channels: the pen, the Teletype and the frame clock are served directly | fifteen channels, as above |

The tripp tape's binaries agree: BR is 2 and IC 3, the arithmetic unit's operations sit in destinations 15–17 (octal), and DISP2 turns the vector generator on through destination 10 ([dpr2-encodings.md](dpr2-encodings.md)). Since v0.0.2 the simulator numbers its sources and destinations as the diagram does: BR 2, IC 3, the arithmetic unit's AS, AE and XO 15–17, and our multiplexer MX at D7, GDD1's place. Since then the processor's manual has settled the rest of R1 and how a dial is read on the AGT/30, which the simulator now follows ([dpr2-manual.md](dpr2-manual.md)); how it serves interrupts (R10) is still ours.
