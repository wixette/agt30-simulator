# Development

How to run, check, change and release the simulator. Related documents:
- the rules the code follows: [conventions.md](conventions.md)
- the page's design: [ui-design.md](ui-design.md)
- the model: [../design/architecture.md](../design/architecture.md)

## Running it

There is nothing to build. Serve the repository's root over HTTP:

```
pnpm serve           # or: python3 -m http.server 8000
```

Then open <http://localhost:8000/>. `pnpm serve` tells the browser not to cache, so an edited module is always the one loaded. Browsers do not load modules from `file://`, so opening `index.html` from disk does not work.

**Options in the address** (developer options, not linked from the page):

| Option | What it does |
|---|---|
| `?selftest` | Runs the page's acceptance checks and shows a tick or a cross for each; publishes `window.__selftest = { done, passed, failed }` |
| `?phosphor=p31`, `p4` or `p7` | Uses that phosphor model (R14). `p31` is the default |
| `?debug` | Exposes the machine to the console as `agt` |

The link format of the page itself (`#view=`, `#program=`) is described in [ui-design.md](ui-design.md), U13. It is not frozen before 1.0.0.

## Requirements

- **Node.js 24** (22 or later works) and **pnpm**, pinned in `package.json`; `corepack enable` installs it. These are for the checks only: `pnpm install` fetches three.js for the tests and TypeScript's checker, and the page does not use them.
- **Google Chrome**, for `pnpm shots` only.

## Checks

```
pnpm install
pnpm check        # all three below, in order
pnpm check:refs   # no private references, local paths or broken links
pnpm typecheck    # the JSDoc types, checked strictly; nothing is compiled
pnpm test         # the model, the programs, the scene and the page's data
reuse lint        # every file's licence is declared (REUSE.toml, LICENSES/)
```

`reuse` is a Python tool; without installing it, `uvx --from 'reuse[charset-normalizer]' reuse lint` runs it.

CI runs all four on every push and pull request.

## Branches, versions and releases

- **`main` takes changes only by pull request** (a repository ruleset). Work on a branch.
- **The version lives in one place:** `package.json`. Set it with `pnpm version <x.y.z>`, which also writes the `?v=` stamps. It does not commit or tag (`.npmrc`).
- **A release is a pull request named for its version.** It is tagged `vX.Y.Z` on its merge commit, and its changes are listed in `CHANGELOG.md`. Versions 0.0.x are marked as pre-releases on GitHub.
- **Each push to `main` deploys** the site to GitHub Pages once its tests have passed.
- **Release media** (`pnpm shots`) are written outside the repository. Only the README's pictures are committed.

## Deploying behind a cache

Every file the page names carries `?v=<version>`, so a cache may keep those files for ever. Only `index.html` (and `/`) must be revalidated:

| What | `Cache-Control` |
|---|---|
| `index.html`, `/` | `no-cache` |
| Everything asked for with `?v=` | `public, max-age=31536000, immutable` |

GitHub Pages keeps everything for 10 minutes, so a release reaches everyone there within 10 minutes.

## Documents

| Document | What it is |
|---|---|
| [../design/v0.0.1.md](../design/v0.0.1.md) | The first pre-release: scope, stages, acceptance |
| [../design/architecture.md](../design/architecture.md) | The model, the modules, timing |
| [../design/reconstructions.md](../design/reconstructions.md) | Every reconstruction, and what would settle it |
| [ui-design.md](ui-design.md) | Principles, viewpoints and decisions for the page |
| [conventions.md](conventions.md) | Units, names, code, programs, tests, references |
| [licensing.md](licensing.md) | Licences and attribution |
| [../research/bibliography.md](../research/bibliography.md) | Sources by key |
