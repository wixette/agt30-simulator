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

If a control is wanted somewhere else, move it, or make both places visible at once. Don't make a second copy. One exception: a section's empty state may offer the choices that fill it. With no program loaded, the Program tab lists the programs, each a row that loads it, as the Programs menu does; it is gone once a program is loaded. *(build, after the manual check: "Choose one from Programs" did not say where Programs was.)* Turning a dial by dragging it in 3D and turning the same dial in the console strip are **not** copies. They are two ways to one operation, and they follow the same rules.

### P3. Tools in one dock, one at a time

The program card and the Teletype share one dock under the stage. The reader chooses which one it shows, how tall it is, and whether it is open.

### P4. Occasional actions go in menus and dialogs

Space that is always there is for things that change while you watch: the picture, the dials, the paper. Choosing a program, resetting the machine and About go in the top bar.

### P5. Each surface keeps its voice

| Surface | Case | Translated (when languages come) |
|---|---|---|
| The machine: the Teletype's paper, the AMOS statements, ADEPT source, the marks on the console | UPPER CASE where the machine was | No: the Teletype and AMOS had no lower case, and statements are code |
| The instrument: top bar, viewpoint menu, cards, dock, status line | Sentence case | Yes |

### P6. Unavailable is grayed and explained, never hidden

A control that cannot be used right now stays where it is, grayed. When used, it answers in the status line with the reason. For example: the light pen works only on the Screen viewpoint.

### P7. One status line, always visible

It says what just happened, and why something is grayed.

### P8. A link is a public contract (from 1.0.0)

Once released, a link format may gain fields, but an existing field is never renamed, dropped or read differently. Until 1.0.0 the format may still change (U13). It lives in one module with nothing of the page in it, and its own test pins it down.

### P9. Faithful first; our views say so

What a 1968 operator saw and touched is the primary surface. Anything the real AGT never had (the cutaway tube, the cables that glow with their traffic, slowed time) is labeled as ours where the reader meets it. Nothing on the page exists only to collect feedback (U12).

### P10. One component for each kind of thing

Each kind of control is one component, used the same way everywhere: menu, dialog, icon button, tab, card, chip. They follow Material Design 3 (states, shapes, elevation, motion), in our own colors.
- **Icons are Material Symbols, as inline SVG.** No icon fonts, and no fonts or scripts from a CDN: the page needs no network but its own site. NCSU's system pack is on the site too, loaded only when the operator boots AMRMX or loads one of NCSU's games (U19).
- **Every icon button has a tooltip and a screen-reader name.**
- **The keyboard is first-class:** every control is reachable with Tab and has a visible focus ring. The dock's tabs follow the WAI-ARIA tabs pattern.
- **Motion is short and optional:** camera flights and cross-fades honor `prefers-reduced-motion`.

### P11. A phone gets the same app, not a different one *(v0.0.3)*

Same regions, same order: the top bar packed down to icons and the program's name, the stage across the width, the dock below with its tabs as icons, the status line. The console strip keeps its size and scrolls sideways within the stage. Nothing depends on hover. A desktop comes first: a phone is laid out so that everything works there, not designed for first. As the series' (the TRS-80 simulator's P9).

## Part 2. Viewpoints

**The stage shows the machine at one level, from one viewpoint at a time.**
- A viewpoint is a camera position with its overlays and, for some viewpoints, a 2D surface at the end of the flight.
- The dock holds the tools.
- The console strip stays under the stage whatever the viewpoint, except the Tube on a phone (U2).

### The viewpoints of v0.0.1

| Name (the link's `view=`) | The stage shows | Reached from | Its own controls |
|---|---|---|---|
| `room` (the way in) | The whole installation in 3D: the desk and scope, the Teletype, the racks, the tapes and disks, the cables; seen a little from above (about 17°), straight at the scope, which stands at the installation's middle, so its screen is centered and faces the reader *(build, after the manual check)* | Start; the viewpoint menu | none *(build: Connections, which dimmed the machines and lit the cables, was dropped from v0.0.1 after the manual check: not worth a place in the interface; the cables still glow faintly with their traffic)* |
| `console` | The desk from the operator's seat: the scope, the dials, the keys, the light pen, the joystick | The desk's or the scope's card; the viewpoint menu | none |
| `screen` (2D) | The camera flies to face the scope, then cross-fades to the full-resolution 2D picture in a thin bezel | The scope's card, *Look at the screen* | The light pen (V3) |
| `panel` *(v0.0.5)* | The operator's control panel on the processor rack, square on; its lamps show BR and the machine's state, and its controls take clicks here (R21) | The processor rack's card, *Go to the operator's panel*; the viewpoint menu | The panel's controls |
| `tube` | The scope cut open: the gun, the yoke, the beam, the picture on the inside of the glass, with the X, Y and Z traces under it | The scope's card, *Cut it open* | Time: 1/100,000 on entry, then 1/1,000 or real |

A **viewpoint menu** at the band's left names the viewpoint (*Console ▾*), with its icon, and lists all of them with theirs, the current one checked (Room ⌂, the same as Home's; Console, a desk; Screen, a monitor; Tube, a magnifier over a frame); any can be reached from any other. *Back* and Escape climb one level: Screen and Tube to Console, Console to Room. *(build, after the first manual check: this replaces a breadcrumb, Room › Console › Screen. The tree is three levels of four viewpoints, so the breadcrumb added a notion of levels without helping anyone find a way; and Screen and Tube, both close-ups of the scope, appeared at different places in its lists. Its dropdown's tooltip also covered the dropdown.)*

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
┌ [logo] AGT-30 Simulator   [▤ Programs ▾]  [⏻ Reboot]                         [ⓘ] ┐  top bar
├──────────────────────────────────────────────────────────────────────────────────┤
│ Console ▾                                                    [⌂] [− +]   [Back]  │  stage band
│                                                                                  │
│                  THE STAGE (3D room, or the 2D screen)        ┌ card ──────────┐ │
│                                                               │ The scope      │ │
│                                                               │ Look at screen │ │
│ ╭ dials ◯◯◯◯◯◯ │ keys ▢▢▢▢ ▢▢▢▢ ▢▢▢▢ ▢▢▢▢ │ pen ✎ ╮              └────────────────┘ │  console strip
├════════════════════════════════ drag ════════════════════════════════════════════┤
│ Program •   Teletype   Processor                                               ▾ │  dock tabs
│ THE ADAGE GRAPHICS TERMINAL                                                      │
│ DSPLY (V.CUBE, 2)!                                                               │  (paper, 72 columns)
│ CLOCK (DIALS+1, DI.EX)!                                                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Typing the cube's statements on the Teletype…                                    │  status line
└──────────────────────────────────────────────────────────────────────────────────┘
```

The page is a fixed frame: top bar, stage, dock, status line. The page itself never scrolls.

## Part 4. Decisions

### U1. The dock below the stage, four tools: Program, Teletype, Processor and References

The dock is full width under the stage, resizable by the handle above it, and folds to its tab bar. As in the series, the handle is a row of its own that lights amber while pointed at or dragged; dragging keeps the dock's foot where it is; and the dock remembers its tab, its height and whether it is folded. *(v0.0.3)*
- **Program** is the loaded program's card (U7).
- **Teletype** is the paper and keyboard (U9).
- **Processor** looks into the DPR-2 (U15). *(v0.0.2)*
- **References** lists where to read more (U16). *(v0.0.3)*

A folded dock opens on Program when a program is chosen; an open one stays on the tab the reader chose, and the other tab gets an activity dot. *(build, after the manual check: choosing a program first switched an open dock back to Program, away from the Teletype the reader was watching.)* Its tab carries an activity dot meanwhile (as in the 8800 simulator). The stage keeps at least 320 px of height. Growing the dock shrinks the stage, and the 3D view refits (U4). The dock starts at 30 % of the window's height, and never below 210 px, so the Teletype shows a dozen lines or more. *(v0.0.2, after the manual check: a fixed 210 px showed only four lines of paper on a large window.)*

*Why below:* the room is a wide, flat subject, so a dock on the right would letterbox it. The Teletype needs the width.
*Rejected:*
- a dock on the right, as in the Leibniz simulator: that suits a near-square subject, but here it squeezes the 72 columns;
- a floating card over the stage, which breaks P1.

### U2. Desktops first, phones too

The targets are a 1366 × 768 laptop and a 1920 × 1080 desktop, then phones (P11). Recent Chrome, Edge, Safari and Firefox are supported. The page narrows in steps, as the series' does:
- **Under 700 px (a phone, upright):** the top bar keeps its icons and the program's name; the band's buttons and the strip pack down, and Back keeps only its arrow; a part's card spans the stage; the stage keeps at least 55 % of the height.
- **The Tube on a phone** (upright or on its side): the overlays keep to the top and the foot and the view is framed between them. Time is a compact segmented button without its label; the note is one short line (the beam's state is in the traces' status line); the inset shrinks; the traces pack down to a slim box, each lane named by its letter, the status one sentence. The console strip is not shown there: the dials and keys are in the other viewpoints. On its side, Time and the note share a row and the inset sits at the foot beside the traces. The note and the traces let touches through to the 3D view, at every size. *(after the manual check: on a phone the overlays covered the Tube, leaving the view no room and no way to turn it.)*
- **Under 480 px:** the dock's tabs show only their icons.
- **A phone on its side** (520 px tall or less): the stage keeps 65 % of the height, the dock opens folded at first, and the strip drops its labels.

*(v0.0.3: until then a window under 1,024 px showed a notice that the page was made for a desktop browser.)*

### U3. The top bar

- **Left** (the machine): the logo and title, the **Programs** menu, whose button names the program loaded (*A cube turned by the dials ▾*), so it is in sight in every viewpoint, the Screen included, or says *Programs* with none *(build, after the manual check)*, and, set apart from it, **Reboot**, with the power icon, which reboots the whole terminal: core as at start, the display dark, the paper torn off, no program loaded. *(build, after the manual check: it was called Reset, which beside Programs read as "reset this program"; one reboots a machine, never a program.)*
- **Right** (the app): **About**.

The Programs menu ticks the program loaded; with one loaded, **Unload the program** follows, after a line (U17). *(v0.0.3)*

There is no language menu while there is one language. Choosing a program, or rebooting, while the Teletype is still typing stops the typing (U8). *(build: this replaces graying them, which left a visitor waiting up to 8 seconds for nothing.)*

### U4. Each viewpoint fits its subject into the stage's free area

The stage's top band (viewpoint menu, view tools), the console strip and an open card all float over the canvas. Every 3D viewpoint frames its subject in the area the band and the strip leave free, filling 90 % of whichever side runs out first. An open card is not counted: it sits at the stage's edge, and opening or closing it never moves the view (V1). *(build: counting it shifted the picture on a part's first click.)* It refits when the stage's size changes, until the reader moves the camera themselves; after that the camera stays theirs until they choose a viewpoint (or press ⌂, which goes to the Room). (This is the Leibniz simulator's rule, adopted here.)

### U5. The console strip: dials, function keys, light pen

The strip floats at the bottom of the stage, centered, laid out as the console lays them out: the dials leftmost, then the function switch box, the foot pedals, then the pen.

- **Six dials** (VCD1). A knob with a pointer and no number, as on the console. It turns by dragging, by arrow keys when focused, or by the wheel. Dragging a dial on the desk in 3D does the same. It turns the way a hand turns it: the knob follows the pointer's angle round its center, clockwise up, and once grabbed the pointer may circle as wide as it likes (the wider, the finer). *(build, after the manual check: a vertical drag, chosen first, ignored a sideways drag and turned the knob backwards when the hand went round it)* Under each dial in the strip, a pair of small arrows steps it down or up by 1/32 of its travel, and keeps stepping while held, for a reader who would rather click. *(build, after the manual check)* A small button on the *Dials* label line turns all six back to the center at once, a convenience of ours: the operator turned each by hand. It is not the top bar's *Reboot*, which restarts the whole terminal. §6).
- **Sixteen function keys** in a 4 × 4 grid, the last column set apart, and **PULSE 1** above them, as on FNS1. They are momentary: down while pressed. Space and Enter press them from the keyboard. A key pressed here goes down on the desk in 3D and turns amber there, and one pressed on the desk shows down here (P2). PULSE 1 is there because it is on the box; no program of v0.0.1 uses it, so pressing it says so in the status line (R10). *(build, after the manual check)*
- **The light pen.** It shows its state: *pen: point at the screen* on Screen, grayed elsewhere with the reason (P6). On Screen the pointer over the picture is the pen, and holding the button closes its fingertip switch.

The joystick and the foot pedals are drawn in 3D but are not in v0.0.1's strip: no program of v0.0.1 uses them. Their cards say so. *Since v0.0.5* the strip has the two pedals, F1 and F2, which programs read like keys (R18); *since v0.0.7* they are a group of their own, **Pedals**, after the function keys, and PULSE 1 is alone on the keys' top row, over the second column as on the desk, with a gap below it (M. Howard: PULSE 1 sat on its own row at the top of the button matrix, MH26). Until then the pedals shared PULSE 1's row. Like the dials and keys, the pedals work in both places *(v0.0.7)*: pressed on its treadle in 3D, a pedal goes down and lights in the strip, and one held in the strip tilts down on the floor in amber (P2).

### U6. Cards: one component, one per part or program

- **A part's card** gives the part's name, its buttons (its viewpoints and *Look closer*) right under the name, where they are in sight however long the text, then what it did and how sure its size is (documented, measured from photos, or estimated).
- **The Program tab's card** follows U7.

Cards are text that can be selected and copied.

### U7. The program card

In this order:
1. The program's title, with **Unload** beside it (U17), and what it rebuilds (*FJCC68 Fig. 7*).
2. How to use it, naming the controls: *Turn dials 0–2.*
3. Its actions: a switch for a setting that is on or off (*Depth cueing*, on every 3D program's card, typing a VIEW whose range fits that picture; it shows the machine's own state, so a VIEW typed by hand moves it too), and buttons for the rest. Each types a statement (U8). *(build, after the manual check: the tunnel had two buttons, on and off, which did not show which state it was in)*
4. *What is ours*: the program's reconstructions, linked to About's list.
5. *The statements*: what the Programs menu typed, as on the paper.
6. *The source*: the ADEPT file, read-only, folded by default.

### U8. The Programs menu and card actions type on the Teletype, fast

Choosing a program types its statements on the Teletype, and the AMOS monitor runs them, as an operator's would have been. The paper shows the session, and the card shows the same statements. A card's switches and buttons (*Depth cueing*, *2,000 lines*) also type statements; the card never changes the machine directly. Typing can be interrupted: choosing another program, or *Reboot*, stops it.

The menu and the card type as fast as the monitor takes the characters, 1 ms each, so the picture appears at once, and their echo, and what they set off (the monitor's replies, a program's first line), print at once too. What the machine types on its own (a program's output, BUMP's new RATE) prints at the ASR-33's 10 characters a second, as does a visitor's own typing. *(build, after the manual check: the echo first printed at 10 a second, and tic-tac-toe, whose first act is to type a line, could not be played for 15 seconds while it waited behind it.)*

*Why:* the machine has one way in, the monitor. A visitor sees what was really typed, and can type it themselves.
*Rejected:*
- an instant load that bypasses the monitor, which hides it and makes the paper a lie;
- typing at the ASR-33's 10 a second *(the first build)*: the scope stayed dark for up to 5 seconds while the statements were typed, and with the dock on the program card nothing said why *(changed after the manual check)*.

### U9. The Teletype: paper and keyboard

The paper model and its view follow the 8800 simulator's ASR-33:
- 72 columns, upper case only;
- CR and LF as two separate actions;
- 10 characters a second each way;
- the paper scrolls and keeps its roll.

The keyboard is active when the Teletype tab has the focus. Keys a PC keyboard lacks sit on the paper's toolbar. Lower case is sent as upper case. The AMOS monitor answers as the model does: echoes, results and `?`.

### U10. The theme

The theme is the simulator series' (the Altair 8800 and TRS-80 simulators'): a dark Material 3 scheme of neutral grays round an amber primary, with the series' controls (buttons, top-bar tool buttons, tabs, the segmented button, the switch, the field, menus, tooltips, dialogs, the dock's handle). *(v0.0.3: until then the AGT had a scheme of its own, cool blues, which set it apart from its siblings.)*
- **The brightest thing on screen is the phosphor.** The interface around it is quiet.
- **One color has one meaning:**
  - amber: what to press, and where you are (the open tab, the chosen reading, the processor's line, a part selected);
  - green: on, and done;
  - blue: the story and the data (links, symbols, the traces' X, the digital cables);
  - red: refused, or a fault.
- **Every color is a token** in `css/theme.css`. The canvas and three.js views read the same tokens.

### U11. Every text is a message key, in English only

Every string a reader sees comes from `js/l10n/en.js`, by key, with `{placeholders}`. A test fails while a key is used but missing, or defined but unused. The machine's own voice (P5) is not a message: statements, the paper and source are data.

### U12. Nothing on the page is only for feedback

The page has no feedback link, no survey, and no control that exists only so that people who knew the machine can compare reconstructions. The simulator is public from v0.0.1, and such controls would confuse visitors who meet it cold.
- **About** still lists every reconstruction (from [../design/reconstructions.md](../design/reconstructions.md)). Telling every user where the simulator departs from the machine is not feedback-gathering.
- **Alternatives for comparison** (the phosphor) are developer options in the address (`?phosphor=`), documented in [development.md](development.md) and not linked from the page.

*Rejected:* a phosphor selector in the Screen viewpoint, which would present a guess as a feature of the machine; a "know better? tell us" link.

### U13. Links: `#view=` and `#program=`, not frozen before 1.0.0

The link format names a viewpoint and a program: `#view=tube&program=cube`. Opening such a link boots the terminal and types the program's statements. The address bar keeps only the viewpoint as the visitor moves about *(v0.0.5)*: a link copied from it opens the app as it starts, not in the last program tried. `#program=` is still read, so a link to a program can be made on purpose; a Share button that makes one is for later. The names are chosen carefully now, but the format may still change until 1.0.0, and the README says so. A link never carries octal words: the instruction encodings are reconstructed and may change (R1).

### U14. About

About is a dialog with a title band:
- the logo, the version and what the simulator is;
- one line saying that where the documents stop the simulator reconstructs, that each program's card says what is ours in it, and a link to the whole list in the README's *What is reconstructed* *(build, after the manual check: About first listed all twenty reconstructions, too long for an About; the README lists them, and tests/app.test.js keeps that list complete)*;
- credits: sources, people and libraries;
- the licenses, one per line;
- a link to the source repository;
- at its foot, as the series' About: **References**, which opens the References tab (U16), and **Close**, filled, which has the focus. *(v0.0.3)*

### U15. The Processor tab: a look into the DPR-2 *(v0.0.2)*

A third dock tool, after the 8800 simulator's Debugger, but one that only looks:
- **Registers:** LC, AR, BR, IC, the sense lines S4 and ER, in octal halves; then which program runs, whether interrupts are frozen, the channels in service and waiting, and the instructions so far.
- **A listing of core** with the assembler's symbols: labels, the words in octal halves, and the words read as DPR-2 instructions, as DSPLY's image items, or as words (octal and AMOS characters). An address operand is written as a symbol, or a symbol plus an octal offset, and is a link to it. The word after an 'L instruction is shown as its operand.
- **Go to** takes an octal address or a symbol, with or without an offset; empty, it goes back to where the processor is and turns Follow on. Its dropdown offers places to go, from the machine as it is: the processor, the program running, the picture shown and the CLOCK routines; then the resident routines and the pictures in core. A picture opens as image items, a routine as instructions. The wheel and the arrow keys move through core.
- **The three readings** are one choice, a single-select segmented button (Material 3). *(after the manual check: three separate buttons did not say they excluded each other.)*
- **Follow** keeps the last instruction the processor executed in view, highlighted, a third of the way down, and is on at start. Go to, a link, the wheel or the keys turn it off. *(after the manual check: it first followed LC, which reads 00000 whenever no program runs, since the registers are restored around the CLOCK chain.)*
- It is drawn ten times a second, only while it is in view.

*Why look only:* stepping would have to pause the whole terminal (the frame clock, DSPLY, the Teletype), not the processor alone, and editing core is already the monitor's (OPEN). A view that cannot change the machine cannot break a running program.
*Why:* since v0.0.2 the words in core are the real DPR-2's (R1); typing LIST and OPEN on the Teletype is how an operator read them, but not how a visitor today expects to.
It is labeled where the reader meets it as a view the real AGT never had (P9). It is not only for feedback (U12): it is for anyone curious about the machine.

### U18. The Panel tab: the operator's control panel *(v0.0.5)*

A fifth dock tool, laid out as the manual's photograph of the panel (SRM5 DPR3 Figure 4, p. 12), measured and kept in one table that the 3D panel shares (`panelLayout` in `js/sim/panel.js`): BR's 30 lamp-buttons in five groups of three columns, the 30 PRI switches below them, the machine's buttons along the bottom (OFF, ON, RESET; STEP, CYCLE; HALT, RUN, PAUSE; BTSP, TE; IC 0, IC 1), and at the right RESET BR, the request selector, PULSE 1 and the second OFF. Above it, the switches' word in octal and as an instruction, **Usual setting** while they are not at 24000 77776, and the machine's state. Every control says what it did in the status line. On a phone the panel scrolls sideways in the dock rather than shrink below a finger's width.

The same panel stands on the processor rack in 3D, and the Panel viewpoint frames it; its controls work there too. The strip's and the desk's PULSE 1 are the same button. What each control does to a machine whose monitor is JavaScript is R21.

*Why both:* the tab is where the panel is easiest to use; the rack is where it was, and the operator's walk from the Teletype to it is part of starting the machine. *Why not look only, as the Processor tab:* the panel is the real machine's own, not a view it never had (P9).

### U19. The real monitor: Boot AMRMX *(v0.0.5)*

The Panel tab's bar has **Boot AMRMX**. It loads NCSU's system pack, M. Howard's dump of it (about 400 KB, the repository's copy in `packs/`), once a visit, and boots it. BROSE also loads the games tape (about 430 KB), whose copy of it is whole; it is restored and AMRMX is asked for it by the statement typed on the Teletype, after the date *(v0.0.7)*. The display and any program stop, and the processor runs AMRMX itself, with the vector generator, the Teletype's line and the disk modeled at register level (R22–R24). The paper is torn off, and the view goes to the Screen, where AMRMX draws its banner and asks the date; the status line says to type it in the Teletype tab. AMRMX answers on the screen and does not echo the keys, so the Teletype prints them itself, as one set to half duplex does. From then on every character and every stroke is AMRMX's own. The panel acts on it as on the real machine: HALT stops it, STEP obeys one of its instructions, PULSE 1 is served by its own pivot, and BTSP followed by RUN boots it again. **Reboot** in the top bar, or choosing a program, returns to the simulator's own monitor.

The **Programs** menu lists NCSU's games from the same pack after the simulator's own programs, **LIFE**, **Space War** and *(v0.0.7)* **QUBIC** and **BROSE**, each with its card and its link (`#program=life`), the viewpoint staying as it is, as for the simulator's own programs *(v0.0.7; until then a game went to the Screen, as Boot AMRMX does)*: loading one loads the pack if need be, boots AMRMX afresh *(v0.0.7; until then only if it was not running, and QUBIC loaded after Space War, which overwrites the monitor's pivots, never printed)*, and the game's core image is restored by the simulator's own loader and entered at once, since AMRMX's own statement for a core-image file is not yet found (R24). The status line gives the game's function keys, as far as they are known. LIFE's key 14 returns to AMRMX.

If the pack cannot be loaded, the status line says so and nothing changes. Each try at loading it is given 20 seconds, and three are made, the status line saying so *(v0.0.6)*: a stalled connection had left the page fetching for ever.

*Why it is a button, not the default:* a reader who comes for the paper's pictures and the menu's programs finds them as before; the real monitor asks for a date and a command language from 1976, and is there for whoever wants it. *Why the repository's own copy* *(v0.0.7)*: to 0.0.6 the pack was fetched from M. Howard's repository at a fixed commit, until he agreed to its use and its credit (2026-11-28). The copy in `packs/` is the same file, byte for byte; it loads from the page's own site, quickly and without a second site's outages (P10), and lessons can rely on it.

### U16. The References tab *(v0.0.3)*

A fourth dock tool, as the series' References: one column of links down the middle of the dock, to be looked up rather than read in order. The machine and its lab (N. England's history of the NCSU lab, graphics-history.org, Adage's brochures); Adage's documents on bitsavers.org; NCSU's tapes (M. Howard's repository, its documents, readtape); then the simulator's source, research and bibliography. About's References button opens it.

*Why:* the people and documents the simulator rests on deserve a place a reader can find, and About stays short. The addresses are kept in one file, `js/app/aboutData.js`, and are the only outside addresses the page names (tests/app.test.js, APP-3).

### U17. Each way in has its way back: Unload *(v0.0.3)*

A program is loaded from the Programs menu or from a card in the Program tab, and each path leads back the way it came: the menu, with a program loaded, ends with **Unload the program**; the card has **Unload** beside its title. Both do what Reboot does (core as at start, the display dark, the paper torn off) and the Program tab shows the list of programs again. The status line names the program unloaded.

*Why a reboot:* loading a program types its statements into the monitor, which builds the picture in core; the real terminal had no command to forget them, and anything gentler would leave a picture on the screen with no program named for it. The default state is the one the page opens in.
*Rejected:* a Back on the card that shows the list while the program goes on running: two states (a program running, the list shown) that look like one, and a list headed "Choose a program to run" while one runs.
