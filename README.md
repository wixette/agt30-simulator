# AGT-30 Simulator

[![Tests](https://github.com/wixette/agt30-simulator/actions/workflows/test.yml/badge.svg)](https://github.com/wixette/agt30-simulator/actions/workflows/test.yml)

The Adage Graphics Terminal, model 30 (1968), in your browser: a 30-bit processor that walked a structured picture every frame, a hybrid analog array that turned it in three dimensions in under 4 microseconds a point, and a refreshed vector CRT, with its console and its Teletype.

> **A pre-release (v0.0.6).** The simulator is still changing. Its links (`#view=…&program=…`) may change before 1.0.0, and where the documents stop it reconstructs, as listed below. New in v0.0.6: the scope's white phosphor with its green afterglow, as M. Howard remembers it; since v0.0.5, NCSU's own monitor and games, LIFE and Space War, run from the lab's 1976 system pack ([CHANGELOG.md](CHANGELOG.md)).

**[▶ Try it online](https://wixette.github.io/agt30-simulator/)**: nothing to install. Made for a desktop browser (recent Chrome, Edge, Safari or Firefox), and it works on a phone too.

![The Room: the AGT-30 installation in 3D, a tunnel of squares on the scope, the console's dials and function keys below it, and the session on the Teletype's paper](./images/readme/room.jpg)

<table>
<tr>
<td width="50%"><b>The Screen</b>: the picture close up, here 3-D tic-tac-toe in play, the marks placed with the light pen.<br><img src="./images/readme/screen.jpg" alt="The Screen viewpoint: the 3 x 3 x 3 tic-tac-toe board in the white phosphor, two X's and two O's on its bottom layer, X's turn shown at the top left"></td>
<td width="50%"><b>The Tube</b>: the scope cut open, time slowed 100,000 times, the beam drawing the letter A, with its X, Y and Z signals below.<br><img src="./images/readme/tube.jpg" alt="The Tube viewpoint: the scope's cabinet cut away, the electron gun, the yoke and the beam reaching the face, where the letter A is being drawn; the deflection and intensity traces below; the live screen in the corner"></td>
</tr>
</table>

## Quick start

1. **Choose a program** from **Programs** in the top bar, for example *A cube turned by the dials*. The simulator types its statements on the Teletype, as an operator would have, and the picture appears on the scope.
2. **Play with it:** turn the dials in the console strip under the picture (drag one round, or click its small arrows). Each program's card, in the **Program** tab below, says what to try.
3. **Look closer:** the menu at the top left of the picture changes the viewpoint (Room, Console, Screen, Tube). Click any part of the installation for its card.
4. **Play NCSU's own games:** **LIFE**, **Space War** and **QUBIC** (4 × 4 × 4 tic-tac-toe), at the foot of the Programs menu, run unchanged from the lab's 1976 system pack, which M. Howard recovered, under its monitor AMRMX. Their cards give the keys.
5. **Start again:** **Unload** on the program's card, or at the foot of the Programs menu, takes the program out and reboots the terminal; **Reboot** in the top bar does the same at any time.

## The machine in a few minutes

The AGT-30 was a graphics terminal made by Adage, Inc. of Boston in 1968: a room of equipment for drawing and turning three-dimensional pictures in real time, decades before graphics cards. It worked very differently from a computer today. These are the ideas the simulator shows, with the nearest thing today; [docs/agt30-overview.md](docs/agt30-overview.md) explains the whole machine.

| Then | What it was | The nearest thing today |
|---|---|---|
| **The vector CRT** (the scope) | A cathode-ray tube whose electron beam draws straight lines from point to point, like a pen, instead of sweeping out rows of pixels. There is no frame buffer: a line glows only for a moment after the beam passes. | An oscilloscope; a laser light show |
| **Refresh** | So every picture is drawn again and again, about 40 times a second. A picture with too many lines no longer fits in one refresh, and flickers. | A game's frame rate |
| **The image** | A picture lives in memory as a structured list: move here, draw a line to there, turn by this angle, draw that sub-picture. | A scene graph, or an SVG file |
| **DSPLY** | The program that walks the image every frame and sends each line to the scope. | A graphics driver |
| **The hybrid array** | An analog computer, built of amplifiers, that rotates, scales and moves each point in under 4 microseconds. It is the AGT's speed. | A GPU's vertex shader |
| **The DPR-2** | The processor: 30-bit words, 32,768 of them in magnetic core memory, about 250,000 instructions a second. Numbers are written in octal (base 8), and negative numbers in one's complement, so there is a −0. | A small microcontroller |
| **The Teletype** (ASR-35) | A printing terminal: a keyboard and a roll of paper, upper case only, 10 characters a second. | A terminal window |
| **AMOS** (its monitor, AMRMX) | The operating system's command interpreter. A statement ends with `!`, such as `DSPLY (V.CUBE, 2)!`, "display the picture V.CUBE". | A shell, such as bash |
| **ADEPT** | The assembler, which turns a program's source into the processor's instructions. | An assembler |
| **The dials, keys and light pen** | Six knobs, sixteen function keys, and a pen that sees the beam pass under it to pick what is drawn there. | Sliders, buttons and a touch screen |

## Using the simulator

**The stage** is the installation in 3D. Its viewpoints:
- **Room:** the whole installation: the desk and scope, the Teletype, the racks, the tape and disk drives, and the cables between them.
- **Console:** from the operator's seat.
- **Screen:** the picture close up. This is where the light pen works.
- **Tube:** the scope cut open, the beam drawing in time slowed up to 100,000 times, with its X, Y and Z signals traced.
- **Panel:** the processor's operator's control panel, on its rack.

**The console strip**, under the picture, holds the dials, the function keys, the two foot pedals (F1, F2) and the light pen.

**The dock** below has five tabs. Drag the handle above it to make it taller or shorter; it remembers its tab and height.
- **Program:** the program loaded: what it rebuilds, how to use it, its switches, what in it is ours, and its statements and source.
- **Teletype:** the paper and the keyboard. Click the paper and type statements yourself, each ended with `!`. Some to try:
  - `DSPLY (V.A)!` shows the letter A; `HALT!` stops the display.
  - `V!` asks the monitor its version.
  - `LIST (, RVCD, RVCD+5)!` lists six words of memory in octal.
- **Processor:** a look inside the processor as it runs: its registers, and memory read as instructions, as picture items or as plain words. A view the real AGT never had.
- **Panel:** the operator's control panel, to run, halt and step the processor. **Boot AMRMX** there runs NCSU's monitor alone: type the date it asks for, for example `11/23/76`.
- **References:** where to read more: the history of the NCSU lab, Adage's documents, the tapes of the NCSU lab, and the simulator's own research. About's References button opens it too.

**Seven programs of ours**, from the Programs menu:
- the letter A, the 1968 paper's first picture;
- a cube turned by the dials, and the same cube in perspective, worked out by the processor;
- the tunnel, with and without depth cueing;
- a town built from one house;
- 3-D tic-tac-toe, played with the function keys and the light pen;
- 1,000 random lines, the paper's measure of the array, which you can push until the picture no longer fits a frame.

**Three of NCSU's**, from the lab's system pack: LIFE, Conway's game on a 128 × 128 board; Space War, two ships around a star; and QUBIC, tic-tac-toe on a 4 × 4 × 4 board drawn in three dimensions, its moves typed on the Teletype.

**A link** opens a viewpoint and a program: for example [`#view=screen&program=tic-tac-toe`](https://wixette.github.io/agt30-simulator/#view=screen&program=tic-tac-toe) or [`#program=space-war`](https://wixette.github.io/agt30-simulator/#program=space-war).

## Run it on your own machine

There is nothing to build. Serve the repository's folder over HTTP:

```
git clone https://github.com/wixette/agt30-simulator.git
cd agt30-simulator
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. (Opening `index.html` from disk does not work: browsers do not load its modules from `file://`.)

## What is reconstructed

Much of the AGT is documented, but not all of it. Where the documents stop, the simulator chooses, and each choice is listed here; [design/reconstructions.md](design/reconstructions.md) gives the sources, the reasons, and what would settle each. Since v0.0.2 the processor follows Adage's own manual for it, and real software from North Carolina State University's AGT-30, which M. Howard recovered from tape, bears it out ([research/](research/)).

- **R1.** Settled: the DPR-2's instruction encodings and what each instruction does are the processor's manual's, which the NCSU tapes bear out.
- **R2.** DSPLY is JavaScript, charged at the documented processor time; some of its times are estimates.
- **R3.** Three gaps in the image format are filled our way.
- **R4.** The programs are ours, written before we knew of the NCSU tapes.
- **R5.** The array's analog drift is modeled but off.
- **R6.** Settled: the multiply unit's results are as the processor's manual gives them.
- **R7.** A dial is read through the array's input selector and converter, as on the AGT/30; how the selector's word chooses the dial is ours.
- **R8.** The assembler is ADEPT as its manual describes it, without action operators or relocatable output, and with our syntax for display items' arguments.
- **R9.** What the simulator's own monitor types back is ours: echoes, results and ?; with it, the Teletype takes a whole character at a time. Under AMRMX the line works a bit at a time (R23).
- **R10.** Interrupts: under the simulator's own monitor the pen, the Teletype and the frame clock are served directly; under AMRMX the devices interrupt as its code expects. The program interrupt's pivot, 77743, is AMRMX's.
- **R11.** The pen-hit table's layout and PENHT's code are ours.
- **R12.** Dash mode draws about ten dashes an inch.
- **R13.** The tunnel's perspective routine is JavaScript, charged an estimated time.
- **R14.** The phosphor: P7-like, a cool white flash fading to a long yellow-green afterglow, as M. Howard remembers it; the times are ours, and the GDS1's phosphor is not documented.
- **R15.** Core at start holds the paper's pictures and the resident routines; 32K words, as NCSU's.
- **R16.** Sizes: the scope measured from photographs; the racks, tapes and disks estimated.
- **R17.** The Teletype is an ASR-35 at its documented size, shaped from photographs; the ASR-33 is kept as an option.
- **R18.** The console's devices: shapes from photographs; the pedals as the period's foot switches. The keys and pedals reach the processor as Adage's own switch routines read them.
- **R19.** The cables are a diagram of the signal paths, not the real cabling.
- **R20.** The cutaway and the visible beam are views the real AGT never had.
- **R21.** The operator's panel works on the simulated machine; under the simulator's own monitor, which is JavaScript, PULSE 1's pivot leads to a trap; under AMRMX the panel acts on its code.
- **R22.** AVG1 and the array at register level, for programs that drive the display themselves (AMRMX, LIFE, Space War, QUBIC), with the three-dimensional mode QUBIC uses; which register number is which is ours, from what those programs do with them.
- **R23.** The Teletype's line at bit level, for AMRMX: one interrupt a bit, OPTY sending BR[22], S4[14] receiving; the rate (110 baud) and the clock's timing are ours.
- **R24.** The disk and the bootstrap: DMS2 as AMRMX drives it, from AMLD0's source; our bootstrap loads the monitor, and our loader the games, without NCSU's code for either; the disk's times are ours.

## More

- [CHANGELOG.md](CHANGELOG.md): what changed in each release.
- [docs/agt30-overview.md](docs/agt30-overview.md): the AGT-30 for today's engineers: the processor, the picture, the array, the panel, the disks and the software, in about an hour's reading.
- [docs/development.md](docs/development.md): how to run the checks, change the simulator and release it.
- [research/](research/): what we have learned from the sources, and our correspondence with people who knew the machine.

## Sources and credits

The simulator rests on T. G. Hagan, R. J. Nixon and L. J. Schaefer's paper "The Adage graphics terminal" (AFIPS Fall Joint Computer Conference, 1968); Adage's manuals and brochures, kept by [bitsavers.org](http://www.bitsavers.org/pdf/adage/agt/); N. England's [history of the NCSU graphics lab](https://www.graphics-history.org/ncsu/index.htm); and M. Howard's recollections and [the NCSU tapes he recovered](https://github.com/cramcram/AGT-30). Every source is listed in [research/bibliography.md](research/bibliography.md).

The NCSU tapes and disk image: recovered by Marc Howard and read at the Computer History Museum ([github.com/cramcram/AGT-30](https://github.com/cramcram/AGT-30)). The programs on them by Adage, Inc. and the NCSU graphics lab; authors credited by the initials in their sources, and with them the programmers of whom no record survives. NCSU's system pack is included in [`packs/`](packs/NOTICE) with his permission, as historical software outside this repository's licenses.

It is built with [three.js](https://threejs.org/), [Roboto Flex](https://github.com/googlefonts/roboto-flex) and [Material Symbols](https://github.com/google/material-design-icons).

## License

The code is under the [Apache License 2.0](LICENSE); the documents, data and pictures of our own under [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt). three.js is MIT, Roboto Flex is under the SIL Open Font License 1.1, and Material Symbols is Apache-2.0. NCSU's system pack in `packs/` is historical software under no license of ours; [packs/NOTICE](packs/NOTICE) says where it came from. Each file's license is declared by [REUSE](https://reuse.software); see [docs/licensing.md](docs/licensing.md).
