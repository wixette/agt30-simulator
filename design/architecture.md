# Architecture

How the simulator is built: one model in simulated time, and the views that show it.

**Status:** draft for v0.0.1, 2026-11-09.

Related documents:
- the reconstructions this rests on: [reconstructions.md](reconstructions.md)
- the code's rules: [../docs/conventions.md](../docs/conventions.md)
- sources by key: [../research/bibliography.md](../research/bibliography.md)

## 1. The machine in one picture

```
 core memory ──► DPR-2 (30-bit, 2 µs) ──x,y,z (15 bits)──► HYBRID ARRAY (4 × 3 MDACs) ──x',y',z'──► VECTOR GENERATOR ──► 21" CRT
 the image          runs DSPLY, walks the        coefficients loaded once      uniform spot speed,       12 × 12 in,
 (structured)       image every frame            per transform                 5–39 µs a vector          depth-cued
      ▲                                                                                                    │
      └── Teletype (AMOS), dials, function keys, light pen ◄─────────────────────────────────────────────────┘
```

On the AGT-30 the DPR-2 walks the image in software (DSPLY), on interrupts from the vector generator. Each coordinate it sends passes through the array, which rotates, scales and places it in analog in under 4 µs (FJCC68 pp. 748–755; SRM5 p. 2). The terminal offloads the *arithmetic*, not the *traversal*. The model keeps that split.

## 2. Decisions

**D1. One model drives every view.** The 3D scope face, the 2D Screen, the Tube's traces, the cable glow and the Teletype's paper all read the same `Agt30` instance. No view computes anything about the machine on its own.

**D2. Simulated time is the master clock.**
- The model advances in microseconds.
- Each browser frame advances it by the elapsed wall time, times the time scale (1, 1/1,000, 1/100,000).
- The CRT view receives the strokes drawn in that interval, each with its time.

A picture refreshed 40 times a second on a 60 Hz display is then shown as it was: refreshed 40 times a second, and decaying in between.

**D3. DSPLY is JavaScript, charged at the documented time.** DSPLY was DPR-2 code, and that code is lost (R2). Our interpreter follows the manual's definition of every item, bit for bit. It charges the processor time each step cost: documented where documented (5.5 µs a table vector, SNCOS 178 µs), estimated otherwise, with every estimate listed. Frame times, overruns and the BUMP rate therefore behave as documented.

**D4. User programs run on the DPR-2.** The CLOCK routines, JSR items and the programs started from the monitor run as DPR-2 instructions, at their documented times. They share the processor the way the real one did:
- DSPLY's work comes first;
- the CLOCK chain runs at the tick;
- a foreground program gets what is left.

So a heavy picture slows a program, and a busy program never slows the picture.

**D5. The encodings are one table.** The DPR-2's mnemonics, meanings and times are documented, but its bit layout is not (R1). The layout is one table (`ENCODING` in `js/sim/dpr2.js`). If the real layout is found, only that table changes, and every program's source keeps working.

**D6. Programs are files, not code.** Each program is an ADEPT source file in `programs/`, and `programs/index.json` names its statements, controls and card text keys. The assembler reads the same file in the browser (by `fetch`) and in Node (from disk). The pictures whose data is generated rather than written by hand (the stroke font, Fig. 12's random lines, the tunnel's items) are built into core at start by `js/sim/figures.js`; the rest, and the resident routines, are ADEPT files assembled at start (R15).

**D7. The 3D installation is built from parameters in JavaScript.** Every part is a handful of boxes, profiles and cylinders, built in the page from `params/terminal.json`. Each part carries a size, a source and a confidence (`doc`, `measured`, `est`, `design`). There is no Blender step and no `.glb`, so the repository needs no Git LFS, and Node tests check the same geometry the page shows.

**D8. Analog error is modelled, and off by default.** The array computes exactly on 15-bit one's-complement inputs. Quantisation always applies. Drift is in the model (R5) but is not exposed in v0.0.1.

## 3. Modules

```
js/sim/        the machine: no DOM, no three.js
  words.js       30-bit words, 15-bit halves, one's complement, octal, fractions and angles
  image.js       the DSPLY image format: items, data types, address modes; a builder for figures
  array.js       the hybrid array: PS[D + SC(R x)] per row, quantised; drift (off)
  vecgen.js      AVG1 timing per vector, short mode, clamping, blanking, dash mode
  dsply.js       DSPLY: walks an image each frame, loads the array, sends strokes, charges time,
                 handles SKIP / ALL / CUT / BUMP, the pen-hit table
  frameclock.js  120 / (RATE + 1) frames a second
  terminal.js    the display terminal: core, DSPLY, array, vector generator, clock
  dpr2.js        the processor: registers, transfer bus, EAU, PRI, timings; ENCODING
  adept.js       the ADEPT subset assembler
  amos.js        the AMOS monitor subset; amoscode.js: the 6-bit code
  teletype.js    the ASR-33's paper model (from the 8800 simulator)
  agt.js         the AGT-30 as a whole: terminal + DPR-2 + devices + Teletype + monitor
  figures.js     the generated pictures, built into core; font.js: the stroke font
  programs.js    reads programs/index.json and the .adept files (the caller supplies the reading)
js/view/       2D views: phosphor.js (the phosphor and the eye, pure), crt.js (the face, the pen's
               inches), traces.js (X, Y, Z), beam.js (the beam at an instant), theme.js (tokens)
js/scene/      three.js: terminal3d.js (built from params), viewer.js (framing, flights, picking,
               the cutaway and the beam)
js/app/        the page: main.js, runner.js (time), stage.js (viewpoints, their menu, cards),
               strip.js, dock.js, programCard.js, teletype.js, about.js, link.js, selftest.js
js/ui/         components.js: icons, tooltips, menus, tabs, dialogs
js/l10n/       l10n.js (lookup) and en.js
js/accept/     acceptance checks shared by tests/ and ?selftest
programs/      *.adept and index.json
params/        terminal.json
```

**The dependency rule:**
- `sim` imports nothing outside `sim`;
- `view` and `scene` import `sim` (types and read-only state);
- `app` imports everything;
- nothing imports `app`.

## 4. What crosses between the model and the views

- **Strokes.** For each stroke: its start and end on the screen, its intensity at each end (the depth cue), its start time and duration, the item that drew it and its image. The X, Y and Z traces and the beam in the Tube are drawn from the same strokes.
- **Activity.** For each link, the simulated time it last carried traffic: the transfer bus, deflection, the memory bus, the Teletype line, the console lines. The cables glow from it.
- **Lamps.** The DPR-2 panel's 30 lamps show AR.
- **Paper.** The Teletype's text and its carriage position.
- **Inputs** go the other way, as calls on `Agt30`: `setDial(n, v)`, `setKey(n, down)`, `pen(x, y, switch)`, `type(char)`.

## 5. Timing, in numbers (documented unless marked)

| What | Value | Source |
|---|---|---|
| Memory cycle; add | 2 µs; 4 µs | FJCC68 p. 748; SRM5 DPR3 p. 1 |
| Multiply (EAU) | 4–10 µs; 6 used | SRM5 DPR3 p. 5; CCT21c |
| Array | under 4 µs, overlapped with drawing | FJCC68 p. 751 |
| Vector | 5–39 µs including 3 µs between; long moves 15 µs | SRM5 AVG1 pp. 1–2 |
| Processor time per table vector | 5.5 µs | SRM5 p. 2 |
| Frame | 120 / (RATE + 1) a second; RATE 2 = 40 is the default | DSPLY pp. 7–9 |
| Teletype | 10 characters a second | SRM5 DPR3 p. 11 |
| DSPLY's other costs | 12 µs a MOVE or DRAW, 8 µs a dispatch, 3 µs an array register, 64 µs SAVT or REST | *est* (R2) |

## 6. Acceptance, in detail

To be written for each area as its stage starts. The outline is in [v0.0.1.md](v0.0.1.md) §4. Each statement gives its source and its tolerance. For example:
- **DSP-4:** with DIM at full scale, a line at z'm = 0 is 10× dimmer than at the front (± 2 %), and a line in front of FRONT is blanked (FJCC68 p. 753).
