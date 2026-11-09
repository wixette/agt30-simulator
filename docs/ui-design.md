# UI design

This document holds the principles the simulator's page is laid out by, and the reasons for them. Where a control ends up, and what it looks like, is the code's business. These rules are what decide it, so that the next change can follow them, or argue with them in the open.

**If a change needs to break a principle, change the principle here first, with its reason.**
- Principles are P1, P2, …
- Viewpoint rules are V1, V2, …
- Decisions are U1, U2, …

A decision records what it supersedes and which alternatives were rejected. The code cites all of them by number.

**Status:** draft for v0.0.1, 2026-11-09.

## Part 1. Principles

### P1. The machine is the one primary surface

It is always on screen. Nothing covers it, and nothing pushes it out of view. The picture on the scope counts as part of the machine: it is always somewhere on screen (V4).

### P2. A control has one home

If a control is wanted somewhere else, move it, or make both places visible at once. Don't make a second copy. Turning a dial by dragging it in 3D and turning the same dial in the console strip are **not** copies. They are two ways to one operation, and they follow the same rules.

### P3. Tools in one dock, one at a time

The program card and the Teletype share one dock under the stage. The reader chooses which one it shows, how tall it is, and whether it is open.

### P4. Occasional actions go in menus and dialogs

Space that is always there is for things that change while you watch: the picture, the dials, the paper. Choosing a program, resetting the machine and About go in the top bar.

### P5. Each surface keeps its voice

| Surface | Case | Translated (when languages come) |
|---|---|---|
| The machine: the Teletype's paper, the AMOS statements, ADEPT source, the marks on the console | UPPER CASE where the machine was | No: the ASR-33 and AMOS had no lower case, and statements are code |
| The instrument: top bar, viewpoint menu, cards, dock, status line | Sentence case | Yes |

### P6. Unavailable is greyed and explained, never hidden

A control that cannot be used right now stays where it is, greyed. When used, it answers in the status line with the reason. For example: the light pen works only on the Screen viewpoint.

### P7. One status line, always visible

It says what just happened, and why something is greyed.

### P8. A link is a public contract (from 1.0.0)

Once released, a link format may gain fields, but an existing field is never renamed, dropped or read differently. Until 1.0.0 the format may still change (U13). It lives in one module with nothing of the page in it, and its own test pins it down.

### P9. Faithful first; our views say so

What a 1968 operator saw and touched is the primary surface. Anything the real AGT never had (the cutaway tube, the cables that glow with their traffic, slowed time) is labelled as ours where the reader meets it. Nothing on the page exists only to collect feedback (U12).

### P10. One component for each kind of thing

Each kind of control is one component, used the same way everywhere: menu, dialog, icon button, tab, card, chip. They follow Material Design 3 (states, shapes, elevation, motion), in our own colours.
- **Icons are Material Symbols, as inline SVG.** No icon fonts, and no fonts or scripts from a CDN: the page needs no network but its own site.
- **Every icon button has a tooltip and a screen-reader name.**
- **The keyboard is first-class:** every control is reachable with Tab and has a visible focus ring. The dock's tabs follow the WAI-ARIA tabs pattern.
- **Motion is short and optional:** camera flights and cross-fades honour `prefers-reduced-motion`.

## Part 2. Viewpoints

**The stage shows the machine at one level, from one viewpoint at a time.**
- A viewpoint is a camera position with its overlays and, for some viewpoints, a 2D surface at the end of the flight.
- The dock holds the tools.
- The console strip stays under the stage whatever the viewpoint.

### The viewpoints of v0.0.1

| Name (the link's `view=`) | The stage shows | Reached from | Its own controls |
|---|---|---|---|
| `room` (the way in) | The whole installation in 3D: the desk and scope, the Teletype, the racks, the tapes and disks, the cables; seen a little from above (about 17°), straight at the scope, which stands at the installation's middle, so its screen is centred and faces the reader *(build, after the manual check)* | Start; the viewpoint menu | none *(build: Connections, which dimmed the machines and lit the cables, was dropped from v0.0.1 after the manual check: not worth a place in the interface; the cables still glow faintly with their traffic)* |
| `console` | The desk from the operator's seat: the scope, the dials, the keys, the light pen, the joystick | The desk's or the scope's card; the viewpoint menu | none |
| `screen` (2D) | The camera flies to face the scope, then cross-fades to the full-resolution 2D picture in a thin bezel | The scope's card, *Look at the screen* | The light pen (V3) |
| `tube` | The scope cut open: the gun, the yoke, the beam, the picture on the inside of the glass, with the X, Y and Z traces under it | The scope's card, *Cut it open* | Time: 1/100,000 on entry, then 1/1,000 or real |

A **viewpoint menu** at the band's left names the viewpoint (*Console ▾*) and lists all four, the current one checked; any can be reached from any other. *Back* and Escape climb one level: Screen and Tube to Console, Console to Room. *(build, after the first manual check: this replaces a breadcrumb, Room › Console › Screen. The tree is three levels of four viewpoints, so the breadcrumb added a notion of levels without helping anyone find a way; and Screen and Tube, both close-ups of the scope, appeared at different places in its lists. Its dropdown's tooltip also covered the dropdown.)*

### Rules

- **V1. Click selects; actions move.** Clicking a part selects it and opens its card. The card offers the part's viewpoints, less the one shown, then *Look closer*. The desk is the exception: it is the console, so its card always offers *Sit at the console*, which at Console reframes it, and no *Look closer*, since Console is its close look. A double-click does the card's first action, so every part answers one. A drag that ends over a part never moves the camera. Choosing the viewpoint already shown from the menu reframes it. A viewpoint is reached with nothing selected. *(build, after the manual check)*
- **V1b. A card belongs to the part, not to the camera.** Clicking a part opens its card. Acting on the part, by its card's buttons or a double-click, keeps the card open, whether that leads to a close look or to the part's viewpoint (the desk to Console). Navigating by the instrument, the viewpoint menu, *Back*, ⌂ or Escape, closes it, as does its close button or a click on nothing. On the Screen the card closes, since no part is shown there; in the Tube it sits below the live inset (V4). *(build, after the manual check)*
- **V1a. A close look is a move, not a viewpoint.** *Look closer* flies the camera in to frame the part beside its card, always from the same place: the first of a fixed list of directions from which no other part hides the side its controls are on. For most parts that side is the front, and the list runs from the front and a little above, then turned left and right, then higher, then from the sides. For the devices on the desk (the dial box, the function switches, the joystick, the light pen) it is the top, and the list starts from above and a little in front, as the operator saw them. A part's stand is left out of its close look, so the Teletype's frames the machine, not its legs. Each part's side is its `face` in `params/terminal.json`; a part may also name, as its `look`, a direction to try first (the Teletype: from the front and well above, for its keyboard and platen). The card stays open with nothing highlighted. It is not in the link or the menu; *Back* and Escape return to the viewpoint's framing. *(build: every part can be selected, and now every part can be looked at.)*
- **V2. Moves are animated and reversible.** The camera flies. A 2D surface cross-fades in at the end of the flight and out at the start of the way back. *Back*, the viewpoint menu and Escape each climb one level.
- **V3. The screen is 2D at the end of the zoom.** The working surface for the picture is the flat canvas at full resolution, not a 3D camera looking at the textured glass. The glass's curve, the perspective and the texture's lower resolution would all soften text, the game's ticks and fine lines, and the light pen would need ray-casting into the texture. The flight makes the 2D screen read as the face of the same tube. The light pen works here and only here.
- **V4. The picture is always on screen.** In Room and Console it is on the scope's face. In Tube a small live inset of the screen sits in a corner of the stage; clicking it goes to Screen.
- **V5. A viewpoint owns its controls.** The Tube owns its time. A viewpoint's own controls sit in one place, a chip under the viewpoint menu; the band's right holds only what works in every viewpoint (⌂, zoom, *Back*). **⌂ goes to the Room, the way in, framed afresh, from anywhere**, as in the 8800 and Leibniz simulators; reframing the viewpoint shown is choosing it again in the menu. *(build, after the manual check: ⌂ first reframed the viewpoint shown, which the menu already did.)* The console strip and the dock never change with the viewpoint. Leaving the Tube puts time back to real time.
- **V6. A viewpoint is part of the link** (`#view=screen`). Its name is chosen now, for good (U13).
- **V7. Keyboard and screen readers** use the viewpoint menu and the cards. Every viewpoint can be reached without pointing into the 3D canvas.
- **V8. Under a 2D viewpoint the 3D scene stops rendering.**

## Part 3. The layout

The installation seen whole is much wider than it is tall, so, as in the 8800 simulator, the dock goes **below** the stage. Below it, the Teletype also gets the full width for its 72 columns.

```
┌ [logo] AGT-30 Simulator   [▤ Programs ▾]  [⏻ Turn off and on]                [ⓘ] ┐  top bar
├──────────────────────────────────────────────────────────────────────────────────┤
│ Console ▾                                                    [⌂] [− +]   [Back]  │  stage band
│                                                                                  │
│                  THE STAGE (3D room, or the 2D screen)        ┌ card ──────────┐ │
│                                                               │ The scope      │ │
│                                                               │ Look at screen │ │
│ ╭ dials ◯◯◯◯◯◯ │ keys ▢▢▢▢ ▢▢▢▢ ▢▢▢▢ ▢▢▢▢ │ pen ✎ ╮              └────────────────┘ │  console strip
├════════════════════════════════ drag ════════════════════════════════════════════┤
│ Program •   Teletype                                                           ▾ │  dock tabs
│ THE ADAGE GRAPHICS TERMINAL                                                      │
│ DSPLY (V.CUBE, 2)!                                                               │  (paper, 72 columns)
│ CLOCK (DIALS+1, DI.EX)!                                                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Typing the cube's statements on the Teletype…                                    │  status line
└──────────────────────────────────────────────────────────────────────────────────┘
```

The page is a fixed frame: top bar, stage, dock, status line. The page itself never scrolls.

## Part 4. Decisions

### U1. The dock below the stage, two tools: Program and Teletype

The dock is full width under the stage, resizable by its top edge, and folds to its tab bar.
- **Program** is the loaded program's card (U7).
- **Teletype** is the paper and keyboard (U9).

The dock opens on Program when a program is chosen, and on Teletype when a program types on the paper while the dock is folded. Its tab carries an activity dot meanwhile (as in the 8800 simulator). The stage keeps at least 320 px of height. Growing the dock shrinks the stage, and the 3D view refits (U4).

*Why below:* the room is a wide, flat subject, so a dock on the right would letterbox it. The Teletype needs the width.
*Rejected:*
- a dock on the right, as in the Leibniz simulator: that suits a near-square subject, but here it squeezes the 72 columns;
- a floating card over the stage, which breaks P1.

### U2. Desktop only in v0.0.1

The targets are a 1366 × 768 laptop and a 1920 × 1080 desktop. Recent Chrome, Edge, Safari and Firefox are supported. On a window narrower than 1024 px, a quiet notice says the simulator is made for a desktop browser. The page still works there; it is just not laid out for it. Phones come later, with the same regions in the same order.

### U3. The top bar

- **Left** (the machine): the logo and title, the **Programs** menu, and, set apart from it, **Turn off and on**, with the power icon, which turns the whole terminal off and on again: core as at start, the display dark, the paper torn off, no program loaded. *(build, after the manual check: it was called Reset, which beside Programs read as "reset this program".)*
- **Right** (the app): **About**.

There is no language menu while there is one language. Choosing a program, or turning the terminal off and on, while the Teletype is still typing stops the typing (U8). *(build: this replaces greying them, which left a visitor waiting up to 8 seconds for nothing.)*

### U4. Each viewpoint fits its subject into the stage's free area

The stage's top band (viewpoint menu, view tools), the console strip and an open card all float over the canvas. Every 3D viewpoint frames its subject in the area the band and the strip leave free, filling 90 % of whichever side runs out first. An open card is not counted: it sits at the stage's edge, and opening or closing it never moves the view (V1). *(build: counting it shifted the picture on a part's first click.)* It refits when the stage's size changes, until the reader moves the camera themselves; after that the camera stays theirs until they choose a viewpoint (or press ⌂, which goes to the Room). (This is the Leibniz simulator's rule, adopted here.)

### U5. The console strip: dials, function keys, light pen

The strip floats at the bottom of the stage, centred, laid out as the console lays them out: the dials leftmost, then the function switch box, then the pen.

- **Six dials** (VCD1). A knob with a pointer and no number, as on the console. It turns by dragging, by arrow keys when focused, or by the wheel. Dragging a dial on the desk in 3D does the same. It turns the way a hand turns it: the knob follows the pointer's angle round its centre, clockwise up, and once grabbed the pointer may circle as wide as it likes (the wider, the finer). *(build, after the manual check: a vertical drag, chosen first, ignored a sideways drag and turned the knob backwards when the hand went round it)* Under each dial in the strip, a pair of small arrows steps it down or up by 1/32 of its travel, and keeps stepping while held, for a reader who would rather click. *(build, after the manual check)* A small button on the *Dials* label line turns all six back to the centre at once, a convenience of ours: the operator turned each by hand. It is not the top bar's *Turn off and on*, which restarts the whole terminal. §6).
- **Sixteen function keys** in a 4 × 4 grid, the last column set apart, and **PULSE 1** above them, as on FNS1. They are momentary: down while pressed. Space and Enter press them from the keyboard. A key pressed here goes down on the desk in 3D and turns amber there, and one pressed on the desk shows down here (P2). PULSE 1 is there because it is on the box; no program of v0.0.1 uses it, so pressing it says so in the status line (R10). *(build, after the manual check)*
- **The light pen.** It shows its state: *pen: point at the screen* on Screen, greyed elsewhere with the reason (P6). On Screen the pointer over the picture is the pen, and holding the button closes its fingertip switch.

The joystick and the foot pedals are drawn in 3D but are not in v0.0.1's strip: no program of v0.0.1 uses them. Their cards say so.

### U6. Cards: one component, one per part or program

- **A part's card** gives the part's name, its buttons (its viewpoints and *Look closer*) right under the name, where they are in sight however long the text, then what it did and how sure its size is (documented, measured from photos, or estimated).
- **The Program tab's card** follows U7.

Cards are text that can be selected and copied.

### U7. The program card

In this order:
1. The program's title, and what it rebuilds (*FJCC68 Fig. 7*).
2. How to use it, naming the controls: *Turn dials 0–2.*
3. Its actions, as buttons. Each one types a statement (U8).
4. *What is ours*: the program's reconstructions, linked to About's list.
5. *The statements*: what the Programs menu typed, as on the paper.
6. *The source*: the ADEPT file, read-only, folded by default.

### U8. The Programs menu and card actions type on the Teletype

Choosing a program types its statements on the Teletype at the ASR-33's 10 characters a second, as an operator would have. The paper shows the session, and the card shows the same statements. A card's action buttons (*Depth cueing off*, *More lines*) also type statements; the card never changes the machine directly. Typing can be interrupted: choosing another program, or turning the terminal off and on, stops it.

*Why:* the machine has one way in, the monitor. A visitor sees what was really typed, and can type it themselves. It takes as long as it did: the longest, the town's, take about 8 seconds.
*Rejected:* an instant load, which hides the monitor and makes the paper a lie.

### U9. The Teletype: paper and keyboard

The paper model and its view follow the 8800 simulator's ASR-33:
- 72 columns, upper case only;
- CR and LF as two separate actions;
- 10 characters a second each way;
- the paper scrolls and keeps its roll.

The keyboard is active when the Teletype tab has the focus. Keys a PC keyboard lacks sit on the paper's toolbar. Lower case is sent as upper case. The AMOS monitor answers as the model does: echoes, results and `?`.

### U10. The theme

The theme is a dark Material 3 scheme, with tokens copied from the graduated simulators' `css/theme.css`, never linked.
- **The brightest thing on screen is the phosphor.** The interface around it is cool and quiet.
- **One colour has one meaning:**
  - blue: the instrument;
  - blue-grey: the machine's controls;
  - amber: your turn;
  - green: done;
  - red: refused, or a fault.
- **Every colour is a token** in `css/theme.css`. The canvas and three.js views read the same tokens.

### U11. Every text is a message key, in English only

Every string a reader sees comes from `js/l10n/en.js`, by key, with `{placeholders}`. A test fails while a key is used but missing, or defined but unused. The machine's own voice (P5) is not a message: statements, the paper and source are data.

### U12. Nothing on the page is only for feedback

The page has no feedback link, no survey, and no control that exists only so that people who knew the machine can compare reconstructions. The simulator is public from v0.0.1, and such controls would confuse visitors who meet it cold.
- **About** still lists every reconstruction (from [../design/reconstructions.md](../design/reconstructions.md)). Telling every user where the simulator departs from the machine is not feedback-gathering.
- **Alternatives for comparison** (the phosphor) are developer options in the address (`?phosphor=`), documented in [development.md](development.md) and not linked from the page.

*Rejected:* a phosphor selector in the Screen viewpoint, which would present a guess as a feature of the machine; a "know better? tell us" link.

### U13. Links: `#view=` and `#program=`, not frozen before 1.0.0

The link format names a viewpoint and a program: `#view=tube&program=tic-tac-toe`. Opening such a link boots the terminal and types the program's statements. The names are chosen carefully now, but the format may still change until 1.0.0, and the README says so. A link never carries octal words: the instruction encodings are reconstructed and may change (R1).

### U14. About

About is a dialog with a title band:
- the logo, the version and what the simulator is;
- **What is reconstructed**: the short form of each entry in [../design/reconstructions.md](../design/reconstructions.md);
- credits: sources, people and libraries;
- the licences, one per line;
- a link to the source repository.
