# Conventions

The rules that keep the model, the parameters, the code and the tests consistent. Related documents:
- the page's principles: [ui-design.md](ui-design.md)
- licences: [licensing.md](licensing.md)
- how the model is structured: [../design/architecture.md](../design/architecture.md)

## Units, axes and names

| Where | Unit |
|---|---|
| `params/terminal.json` | millimetres and degrees, with each value's `source` and `confidence` (`doc`, `measured`, `est`, `design`) |
| three.js | metres; the build converts once |
| The model | microseconds for time; screen coordinates as DSPLY fractions (−1 … 1, full scale 10 in); words as integers, shown in octal |

- **The params' frame** is the one drawings are dimensioned in: +X runs to the operator's right, +Y away from the operator, and +Z up, in millimetres. The scene builder converts once to three.js's frame (metres, +Y up, the operator looking along −Z).
- **Node names** follow `<unit>.<part>[.<index>]`: lower-case ASCII, unique once the dots are removed. Examples: `scope.face`, `console.dial.3`, `rack.dpr2.lamp.17`. They are the contract between the params, the scene and the tests.
- **Machine names** keep the documents' spelling: DPR-2, AMOS, ADEPT, DSPLY, `V.CUBE`, RATE.

## Code

- **Plain JavaScript modules, no build step.** Copying the repository to a web server deploys it.
- **Types are JSDoc,** checked strictly by `pnpm typecheck` (TypeScript's checker with `checkJs` and `strict`; nothing is compiled). Type the code as you write it.
- **Vendored libraries:** three.js, Roboto Flex and Material Symbols are in `vendor/`, reached through the page's import map. Node uses the same versions from `node_modules`, and `tests/vendor.test.js` fails while the two differ.
- **Version stamps:** every local file the page names, and every module in its import map, carries `?v=<version>`. `pnpm stamp` writes them; never edit them by hand.
- **Where code goes:** see [../design/architecture.md](../design/architecture.md) §3. `js/sim/` has no DOM and no three.js.
- **Comments say why,** and cite their source by key and page (`DSPLY p. 8`) or a decision by number (D3, U8, R14). A number in the code that comes from a document names its source next to it.
- **Licence headers:** every JavaScript, CSS and HTML file starts with an SPDX licence header naming Apache-2.0 (REUSE). The ADEPT files in `programs/` carry none, so that their text stays the machine's own (P5); `REUSE.toml` covers them. A file copied from another project keeps that project's copyright line.
- **Text:** every string a reader sees is a message key in `js/l10n/en.js` (U11). Machine text (statements, the paper, ADEPT source) is data, not a message.
- **Generated files are never edited by hand.**

## Programs

- One ADEPT file per program in `programs/`, in upper case, commented with `[` as the manuals do. It cites what it rebuilds and says what is ours (R4).
- `programs/index.json` lists for each program:
  - its id (the link's `program=`, chosen for good from 1.0.0);
  - its title and card text keys;
  - its statements;
  - its controls;
  - the reconstructions it uses.
- A program's statements must give no `?` (check PRG).

## Tests

- **Node's own runner,** `pnpm test`: `tests/**/*.test.js`, with `node:assert`. No browser, GPU or network.
- **Acceptance IDs by area:** `WRD`, `IMG`, `ARR`, `VG`, `DSP`, `CRT`, `CPU`, `MON`, `ASM`, `TTY`, `PRG`, `SCN`, `VW`, `APP` ([../design/v0.0.1.md](../design/v0.0.1.md) §4).
  - Each statement is one test, named after its ID (`it("DSP-3: …")`).
  - Its tolerance is a named constant, with the reason.
  - The checks live in `js/accept/`, shared with the page's `?selftest`.
- **Tests are written from the documents,** not from the code's output. A test's expected value cites its source, or a decision when the value is ours.
- **Scene checks** build the installation from the params in Node and measure it:
  - clearances across all pairs, never a hand-picked list of pairs;
  - supports;
  - cable ends;
  - the triangle budget.
- **CI** runs, on every push and pull request: `pnpm check:refs`, `reuse lint`, `pnpm typecheck` and `pnpm test`.

## No developer pages

There is one page, `index.html`. The model is verified by the Node tests and by `?selftest` on that page. Developer options in the address (`?selftest`, `?phosphor=`, `?debug`) are documented in [development.md](development.md) and not linked from the page.

## References

The repository is public. Everything in it must be readable and followable by anyone:
- **Links** stay inside the repository or go to public URLs. A relative link must lead to a file that exists here.
- **No absolute local paths** anywhere.
- **No mention of private material,** such as unpublished development repositories or private correspondence.
- **Learner-facing text** names the simulator and the machine, and nothing about how it is developed.

`pnpm check:refs` (`tools/check-refs.mjs`) checks all four, and CI runs it.
- **Forbidden names** are held only as SHA-256 digests of lower-cased tokens. The tool hashes every word and hyphenated run of a file and compares, so the names never appear in the repository, not even in pieces.
- **Local paths** are matched by pattern.
- **Relative links** are resolved against the files.
