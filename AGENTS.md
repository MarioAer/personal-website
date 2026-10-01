# AGENTS.md

Instructions for AI agents working in this repository.

## What this project is

A personal consulting website published on GitHub Pages at
`https://marioaer.github.io/personal-website/`.

Its distinguishing feature: the same written specification is implemented by several AI
models, each as a self-contained folder under `variants/`. A selector in the top bar lets a
visitor switch between the implementations and read the specification they were all built
from. The specification is therefore the authority, not any one implementation.

`spec/2026-10-01-personal-website-design.md` is that specification. Read it before changing
anything structural. Its section numbers are referenced throughout this file.

## Commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit`. Never emits; the type checker is the only thing TypeScript does here. |
| `npm test` | Unit suite, Node's built-in runner, `tests/**/*.test.ts`. |
| `npm run build` | Validates everything and writes `dist/`. Takes `BASE_PATH`, default `/`. |
| `npm run test:e2e` | Playwright, five browser projects. |
| `npm run serve` | Serves `dist/` locally under `BASE_PATH`. |

Before claiming any change works, run all four of these:

```sh
npm run typecheck
npm test
BASE_PATH=/personal-website/ npm run build
npx playwright test --project=chromium-desktop --project=webkit-desktop --project=chromium-phone --project=webkit-phone
```

The `firefox-desktop` Playwright project cannot launch on the maintainer's macOS machine.
Its failures there are environmental; CI on Linux exercises it. Do not try to fix it locally
and do not remove it from the configuration.

CI runs the browser suite in the Playwright container image. Its tag and the pinned
`@playwright/test` version must be upgraded together.

## Language and runtime

Node 24 or newer, which runs `.ts` files directly by stripping types. There is no compiler
in the run path and no build step.

Consequences you must respect:

- Imports carry the `.ts` extension: `import { build } from './build.ts'`.
- `erasableSyntaxOnly` is on. No `enum`, no `namespace`, no parameter properties. If the
  type checker rejects your syntax, Node would not have run it either.
- `shell/shell.js` stays JavaScript with JSDoc types. It is served to browsers unmodified,
  so it can never become TypeScript.
- No `any`, and no `as` type assertions. Parsed JSON is `unknown` and is narrowed by the
  type guards in `scripts/lib/registry.ts`.

## Layout

```
spec/                 the specification and the prompt given to generating models
variants/<id>/        one model's implementation: plain HTML, CSS, optional vanilla JS
variants.json         registry: default variant, entries, contact links
shell/shell.js        the shared top bar, injected into every page
scripts/build.ts      validate, assemble dist/, rewrite the base path, render the spec page
scripts/lib/          registry validation, variant contract checks, spec renderer
scripts/serve.ts      static server for dist/, used locally and by Playwright
tests/                unit suite
e2e/                  browser suite
```

Each module under `scripts/lib/` is a pure function with one job. `build.ts` only
orchestrates them. Keep it that way.

## Do not touch

- `dist/` — build output, git-ignored, regenerated on every build.
- `spec/2026-10-01-personal-website-design.md` sections 1 to 5 and section 11 — the content,
  the positioning, and the decisions the owner has settled. Changing what the site says is
  their decision, not yours. Sections 6 to 10 describe the machinery and may change with the
  code.
- A variant folder you were not asked to work on. Each is one model's output and is
  compared against the others; editing someone else's variant invalidates the comparison.
- `variants.json` contact URLs — the single place a contact URL is defined. The fallback
  constant in `shell/shell.js` mirrors them and a test holds the two in agreement.

## Writing or changing a variant

A folder under `variants/<id>/` is valid only when all of this holds. The build enforces
rules 1 to 3 and 5, warns on 4, and fails naming the variant and the rule.

1. `index.html` exists and contains `<meta name="variant" content="<id>">` matching the
   folder name.
2. Exactly one `<script type="module" src="/shell/shell.js"></script>`, inside `<head>`.
   This is the only absolute path a variant may contain; the build rewrites it for the
   deployment base path.
3. Every other reference is relative, a `data:` or `blob:` URI, or a fragment. `../` is
   forbidden. No external URLs in any resource position. The one exception is `<a href>`,
   which may be `https://`; `mailto:` and `tel:` are forbidden.
4. Variant JavaScript must not request absolute paths. The default variant is served both
   at the site root and under `/<id>/`, so resolve assets against `document.baseURI`.
5. No top-level entry named `shell`, `spec`, `404.html`, `variants.json`, `CNAME` or
   `.nojekyll`.

Further constraints from specification section 5: plain HTML, CSS and optional vanilla
JavaScript, no framework, no build step, no external CDN for scripts, styles or fonts.
Both light and dark themes must be styled. Leave the top 56 pixels of the viewport free for
the bar. Responsive from 360 to 1920 pixels with no horizontal scrolling.

To add a variant: create the folder, add one entry to `variants.json`, commit. The registry
entry needs `id`, `label`, `tool`, `toolVersion`, `modelId`, `generatedAt`, `specVersion`
and `attempts`. The id must match the folder name and may not be a reserved name.

Content rules, from specification section 4.2: every factual statement must trace to the
specification. Invent no role, employer, date, client, number or qualification. Clients are
described, never named; employers may be named. Formal register, no contractions, no
idioms, no emojis.

## Conventions

- Commit messages: `type: description`, lowercase, imperative, no trailing period. This
  repository uses only `chore`, `ci` and `docs`. Other conventional-commit types would
  require a ticket number this project does not have, and the maintainer's environment
  rejects them. Hard limit 250 characters. Every commit in the history follows this.
- Split logically distinct changes into separate commits, each independently revertable.
- Branch from `main`, never commit to it directly.
- Tests are written before the implementation. A test that passes when the thing it names
  is removed is not a test; this suite has been mutation-checked and should stay that way.
