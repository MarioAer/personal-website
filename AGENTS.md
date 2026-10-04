# AGENTS.md

The rules of this repository, for agents and people alike. Everything that is not the site's
content is defined here, once.

## What this project is

A personal website published on GitHub Pages at `https://marioaer.github.io/personal-website/`.
The same content specification is implemented by several AI models, each as a self-contained
folder under `variants/`. A selector in the top bar switches between the implementations, and
a "View spec" link opens the specification version the current variant was built from.

| Question | Answer lives in |
| --- | --- |
| What the site says | `spec/<date>.md`, the newest file is current |
| How it is built, validated, tested and deployed | this file |
| Which variants exist, contact and repository URLs | `variants.json` |
| How to run things | `mise.toml` tasks, listed below |

## Tasks

Run with `mise run <task>`. Each wraps an npm script, so `npm run` works as well.

| Task | What it does |
| --- | --- |
| `install` | `npm ci` |
| `typecheck` | `tsc --noEmit`. The type checker is the only thing TypeScript does here. |
| `test` | Unit suite, Node's built-in runner, `tests/**/*.test.ts`. |
| `build` | Validates everything and writes `dist/`. `BASE_PATH` defaults to `/personal-website/`. |
| `serve` | Builds, then serves `dist/` under `BASE_PATH`. |
| `e2e` | Playwright browser suite, five projects. |
| `check` | `typecheck`, `test` and `build`. Run before claiming any change works. |
| `ci` | The GitHub workflow's steps in its order: `install`, `typecheck`, `test`, `e2e`, `build`. |

`mise.toml` matches CI: the same Node major version, the same steps. Change one, change the
other. CI runs the browser suite in the Playwright container image; its tag and the pinned
`@playwright/test` version must be upgraded together.

## Specification versions

- `spec/<YYYY-MM-DD>.md`. The filename is the version; the newest file is the current
  specification. A content change is a new file, never an edit to an older one.
- Each variant's `specVersion` must name an existing file; the build fails otherwise. The shell
  links "View spec" to that file on GitHub and marks a variant whose version is older than the
  current one.
- The specification holds content only: purpose, audience, positioning, content inventory and
  content rules. It is the owner's; changing what the site says is their decision.

## Architecture

Static site, served by GitHub Pages, built by a small Node script. No site framework and no
front-end library: the site has three interactions (theme, variant navigation, opening the
specification), none of which a library would shorten, and every dependency is weight each
variant carries. The fewer framework rules a variant must obey, the fairer the comparison and
the simpler it is to add one. Astro and Next.js static export were considered and rejected for
constraining the variants.

The tooling is TypeScript executed directly by Node 24, which strips the types at load time.
There is no compiler in the run path. The only code shared with the browser is the shell.

```
spec/<date>.md          content specification, one file per version
variants/<id>/          one model's implementation: plain HTML, CSS, optional vanilla JS
variants.json           registry: default variant, entries, contact links, repository
shell/shell.js          the shared top bar, injected into every page
scripts/build.ts        validate, assemble dist/, rewrite the base path
scripts/lib/            registry validation, variant contract checks, spec versions
scripts/serve.ts        static server for dist/, used locally and by Playwright
tests/                  unit suite
e2e/                    browser suite
mise.toml               tasks
dist/                   build output, git-ignored
```

Each module under `scripts/lib/` is a pure function with one job. `build.ts` only orchestrates
them.

## Registry (`variants.json`)

```json
{
  "default": "claude-fable-5.1",
  "variants": [
    {
      "id": "claude-fable-5.1",
      "label": "Claude Fable 5.1",
      "tool": "Claude Code",
      "toolVersion": "2.1.0",
      "modelId": "claude-fable-5-1",
      "generatedAt": "2026-10-02",
      "specVersion": "2026-10-01",
      "attempts": 1
    }
  ],
  "contact": {
    "linkedin": "https://www.linkedin.com/in/marioaer",
    "github": "https://github.com/MarioAer"
  },
  "repository": "https://github.com/MarioAer/personal-website"
}
```

Rules, all checked by the build:

- `id` matches `^[a-z0-9][a-z0-9.-]*$`, is unique, and equals the folder name under `variants/`.
- `id` is not a reserved name (`shell`, `index.html`, `404.html`, `variants.json`, `CNAME`,
  `.nojekyll`) and does not equal a top-level entry of the default variant, whose files are
  copied to the output root.
- `default` names an existing `id`. The default variant is served at the site root; every
  variant, the default included, is also served at `<base>/<id>/`.
- `modelId` is the exact model identifier the tool used, `toolVersion` the tool's reported
  version, `attempts` the number of full generation runs before acceptance.
- `specVersion` names an existing `spec/<specVersion>.md`. The build writes the current version
  into the output registry as a top-level `specVersion`.
- Order in the array is the order in the selector.
- `contact` and `repository` are https URLs and the single place they are defined. The fallback
  contact constant in `shell/shell.js` mirrors `contact`; a test holds the two in agreement.

## Variant contract

A folder under `variants/<id>/` is valid when:

1. `index.html` exists and contains `<meta name="variant" content="<id>">` with the folder's id.
2. `index.html` contains exactly one `<script type="module" src="/shell/shell.js"></script>`, in
   `<head>`. This is the only absolute path a variant may contain; the build rewrites it to the
   deployment base path.
3. Every other resource reference is relative (`./style.css`, `fonts/inter.woff2`; `../` is
   forbidden), a `data:` or `blob:` URI, or a fragment. The build checks `src`, `href`, `srcset`,
   `poster`, `data` and `xlink:href` on every element in `index.html` and `.svg` files, and
   `url()` and `@import` in `<style>`, `style` attributes and `.css` files. The one exception is
   `<a href>`, which may be `https://`; `mailto:`, `tel:` and every other scheme are forbidden.
   The check is syntactic, not a guarantee about computed URLs.
4. Variant JavaScript does not request absolute paths (`fetch('/x')`), because the default
   variant is served both at the root and under `/<id>/`. Resolve assets against
   `document.baseURI`. The build warns on a string literal starting with a single `/`; the
   reviewer decides.
5. No top-level entry is a reserved name (see Registry).
6. The content satisfies the content inventory of the specification (checked by review).

The build enforces 1 to 3 and 5, warns on 4, and fails naming the variant and the rule.

## Design constraints for variants

Variants have full freedom of visual design within these limits:

- Responsive from 360 px to 1920 px wide; no horizontal scroll.
- Light and dark theme. The shell sets `data-theme="light"` or `data-theme="dark"` on `<html>`;
  style both. With no attribute, follow `prefers-color-scheme`.
- Semantic HTML: one `<h1>`, landmarks (`<header>`, `<main>`, `<footer>`), descriptive link text,
  visible focus states, colour contrast of at least 4.5:1 for body text.
- Fonts self-hosted in the variant folder or system fonts. No third-party font or script CDNs;
  the site works offline once loaded and leaks no visitor data.
- Reserve the top 56 px for the shell's bar (`padding-top: var(--shell-height, 56px)` on
  `<body>` or equivalent). The bar lives in a shadow root; variant CSS must not restyle it.
- Plain HTML, CSS and optional vanilla JavaScript; no framework, no build step. A variant is a
  folder a browser can serve directly, at the site root and under `/<id>/`.
- Total transferred weight under 1 MB, images included.

## Shell (`shell/shell.js`)

One JavaScript file with JSDoc types, served to browsers unmodified; it never becomes
TypeScript. No framework, no runtime dependency. It:

1. Creates a `<site-shell>` element as the first child of `<body>` with a shadow root holding the
   bar's markup and styles, so variant CSS and bar CSS cannot reach each other.
2. Derives the site base as `new URL('..', import.meta.url)` and fetches `<base>variants.json`
   with `{ cache: 'no-cache' }`.
3. Renders the site name linking to `<base>`; a theme toggle that writes `data-theme` on `<html>`
   and stores it in `localStorage` under `theme`; a labelled `<select>` navigating to `<base>` for
   the default id and `<base><id>/` otherwise; "View spec" linking to
   `<repository>/blob/main/spec/<specVersion>.md` (the variant's version, or the current one on
   pages that are not a variant); LinkedIn and GitHub links with accessible labels; the colophon
   (model label, generation date, specification version, and a notice when it is older).
4. Sets `--shell-height: 56px` on `:root`.

When `variants.json` fails to load, the selector and "View spec" are hidden and the contact
links fall back to the mirrored constant.

## Build (`scripts/build.ts`)

Inputs: the repository, `BASE_PATH` (default `/`) and optionally `SITE_DOMAIN`.

1. Read the specification versions from `spec/`; fail when there is none.
2. Validate `variants.json` (Registry) and every variant (Variant contract); fail on the first
   violation, print all warnings.
3. Empty `dist/`, copy the default variant to `dist/` and every variant to `dist/<id>/`.
4. In every copied HTML file, rewrite the shell script `src` to `${BASE_PATH}shell/shell.js`.
   Nothing else is rewritten.
5. Copy `shell/`, and write `dist/variants.json` with the current `specVersion` added.
6. Write `dist/.nojekyll`, `dist/404.html` (shell, heading, a sentence pointing to the selector),
   and `dist/CNAME` when `SITE_DOMAIN` is set.

Output is deterministic: identical inputs produce byte-identical `dist/`.

## Deployment

GitHub Actions on push to `main`: install, typecheck, unit and browser suites, build, upload
`dist/`, deploy to Pages. Pull requests run everything except the deployment. `BASE_PATH` is
`/<repository name>/` unless the repository variable `SITE_DOMAIN` is set, in which case it is
`/` and `dist/CNAME` is written.

A custom domain needs the `SITE_DOMAIN` variable, the DNS records (CNAME or A/AAAA plus
GitHub's verification TXT record) and the domain entered once in the Pages settings. Renaming
the repository to `marioaer.github.io` serves at the root without one.

## Generating a variant

1. Create a branch `variant/<id>`.
2. Give the model the current specification and this file, with the prompt below. Record
   `modelId`, `toolVersion` and the date in the registry entry.
3. Generation is single-shot. Contract or content violations are fixed by the model in the same
   session. One full regeneration is allowed; `attempts` records the count. If the second run
   also fails review, the variant is not published; the branch is kept.
4. Add the registry entry with `specVersion` set to the specification used, run `mise run check`
   and look at the result with `mise run serve`.
5. Review against the content inventory, the design constraints and the contract warnings. Every
   fix is first requested from the model; manual edits are a last resort, listed in the
   variant's `NOTES.md`.
6. Open a pull request; merge after review.

Prompt:

```
You are implementing one version of a personal website.

Read spec/<VERSION>.md (the content) and AGENTS.md (the rules) in full before writing anything.
Implement the specification's "Positioning" and "Content inventory" as one self-contained
folder at variants/<ID>/, following the AGENTS.md sections "Variant contract" and
"Design constraints for variants".

Write only inside variants/<ID>/. Every factual statement must come from the specification.
The visual design is yours; the content and the constraints are not.

When you have finished, run `mise run check` and fix anything it reports.
```

## Testing

Node's built-in test runner for pure functions, Playwright for everything that needs a
browser. No jsdom, no second assertion library. Tests are written before the implementation.
A test that passes when the thing it names is removed is not a test; this suite has been
mutation-checked and should stay that way.

| Layer | Covers |
| --- | --- |
| Unit (`tests/`) | Registry rules, each contract rule with a passing and a failing fixture, specification versions, and the build on a fixture repository: layout, shell path for `/` and a subpath, `specVersion` injected, determinism. |
| Browser (`e2e/`, Chromium, Firefox and WebKit at 360×780 and 1440×900, against `dist/` built for `/personal-website/`) | Theme toggle persists; selector navigates for default and other ids; "View spec" links the right version; bar works without the registry; LinkedIn and GitHub on every variant and the 404 page; no console errors or third-party requests; one `<h1>` and the landmarks; no horizontal scroll; the bar's 56 px kept clear; no email address, `mailto:` or `tel:`. Nothing that quotes the specification's wording, so a new version does not break the suite. |

Accessibility and performance are checked manually with Lighthouse before a variant is merged.
Manual review covers everything the specification says: the content inventory, numbers, tone and visual quality.

## Conventions

- Node 24 or newer runs `.ts` directly. Imports carry the `.ts` extension. `erasableSyntaxOnly`
  is on: no `enum`, no `namespace`, no parameter properties.
- No `any` and no `as` assertions. Parsed JSON is `unknown`, narrowed by the type guards in
  `scripts/lib/registry.ts`.
- Commit messages: `type: description`, lowercase, imperative, no trailing period, at most 250
  characters. Only `chore`, `ci` and `docs` are used; other types would require a ticket number.
- One logical change per commit, each independently revertable.
- Branch from `main`; never commit to it directly.

## Do not touch

- `dist/`: build output.
- Any `spec/` file's content: the owner's decision. Older versions are never edited.
- A variant folder you were not asked to work on: editing another model's output invalidates
  the comparison.
- The URLs in `variants.json`, unless asked.

## Out of scope

Blog, articles, RSS; contact form, analytics, cookies; CV download; server-side code; a content
management system (content changes are a new specification version followed by regenerated
variants).
