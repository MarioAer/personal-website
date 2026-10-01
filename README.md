# personal-website

The personal site of Mario Erazo, published at
[marioaer.github.io/personal-website](https://marioaer.github.io/personal-website/).

One specification, several implementations. The same written brief was handed to several AI
models, and each produced its own version of the site. A selector in the top bar switches
between them, and a link opens the specification they were all built from, so a visitor can
see both the instruction and how differently models interpreted it.

## How it is put together

Each implementation is a folder of plain HTML and CSS under `variants/`, listed in
`variants.json`. One shared file, `shell/shell.js`, injects the top bar on every page: the
theme toggle, the version selector, the specification link and the contact links. A Node
script validates each folder against a contract, assembles the site into `dist/`, and
renders the specification into a page. GitHub Actions publishes it.

There is no framework and no build step for a variant: a variant is a folder a browser can
serve as it stands. The tooling is TypeScript, run directly by Node, which strips the types.
Nothing is compiled.

## Working on it

Requires Node 24 or newer.

```sh
npm install
npm run typecheck
npm test
BASE_PATH=/personal-website/ npm run build
npm run serve
```

`npm run test:e2e` runs the browser suite: Chromium and WebKit at both phone and desktop
widths, and Firefox at desktop width.

## Adding a version

Create `variants/<id>/`, add an entry to `variants.json`, commit. The build refuses a folder
without a registry entry, a registry entry without a folder, and any variant that breaks the
contract.

## Where things are

| Path | |
| --- | --- |
| `spec/` | The specification, and the prompt handed to each generating model |
| `variants/` | One folder per implementation |
| `shell/shell.js` | The shared top bar |
| `scripts/` | Build, validation, static server |
| `tests/`, `e2e/` | Unit and browser suites |
| `AGENTS.md` | Instructions for AI agents working in this repository |
