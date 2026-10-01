# Personal Website Kickstart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static site infrastructure (registry, contract checks, build, shell, CI) and the first model-generated variant, so the site is publishable on GitHub Pages.

**Architecture:** Every implementation of the site is a self-contained folder of plain HTML, CSS and optional JavaScript under `variants/<id>/`. A dependency-free Node build script validates the folders against a contract, assembles `dist/`, rewrites the single absolute path each variant may contain, and renders the specification into an ordinary page. One shared file, `shell/shell.js`, injects a fixed top bar into a shadow root: theme toggle, variant selector, specification link, contact links.

**Tech Stack:** Node 22 (standard library plus `marked` for the specification page), Playwright for browser tests, `node --test` for everything else, GitHub Actions and GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-01-personal-website-design.md`

## Global Constraints

- Node 22 or newer. `package.json` declares `"type": "module"` and `"engines": {"node": ">=22"}`.
- Runtime dependencies: none. Development dependencies: exactly `marked` and `@playwright/test`.
- No front-end framework or library, in the shell or in any variant. No external CDN for scripts, styles or fonts.
- `BASE_PATH` is a build input, defaulting to `/`. The only absolute path a variant may contain is `/shell/shell.js`, which the build rewrites.
- Reserved output names, which no variant id and no variant top-level entry may use: `shell`, `spec`, `index.html`, `404.html`, `variants.json`, `CNAME`, `.nojekyll`.
- Prose written into the site follows the spec's tone rules: formal register, no contractions, no idioms, no emojis. Numbers appear exactly as the spec writes them.
- Commit messages follow `type(TICKET): description`; this repository has no ticket numbers, so the scope-optional types `chore`, `ci`, `docs` are used, and `feat`/`fix`/`test`/`build` are avoided. Hard limit 250 characters.
- Every commit happens on the branch `chore/kickstart`. Never commit to `main`.

## Review Focus

- A variant folder exists on disk but is absent from `variants.json`, or the reverse: the build must fail naming the folder, not silently publish or skip it. Test in Task 1.
- `BASE_PATH` supplied without a trailing slash (`/personal-website`): the rewrite must still produce `/personal-website/shell/shell.js`. Test in Task 4.
- `localStorage` throws or is unavailable (Safari private browsing, blocked site data): the theme toggle must still switch the theme for the session and the page must not break. Test in Task 5.
- The shell script tag written with single quotes or a different attribute order: a legitimate variant must not be rejected by the contract check. Test in Task 2.
- `variants.json` is not valid JSON: the build must fail with a readable message naming the file, not a raw parser stack trace. Test in Task 4.

---
## File Structure

| File | Responsibility |
| --- | --- |
| `package.json` | Scripts and the two development dependencies |
| `variants.json` | Registry: default variant, variant entries, contact links |
| `scripts/lib/registry.mjs` | Pure validation of the registry against the folders on disk |
| `scripts/lib/contract.mjs` | Pure validation of one variant's files against the contract |
| `scripts/lib/render-spec.mjs` | Specification markdown to a complete HTML page |
| `scripts/build.mjs` | Orchestration: validate, copy, rewrite, write `dist/` |
| `scripts/serve.mjs` | Static server for `dist/` under a base path, for local use and Playwright |
| `shell/shell.js` | The top bar: theme, selector, specification link, contact links |
| `variants/<id>/` | One model's implementation of the site |
| `tests/*.test.mjs` | `node --test` suites for the three library modules and the build |
| `e2e/*.spec.js` | Playwright suites for the shell and for site content |
| `playwright.config.js` | Three browser projects, two viewports, web server |
| `.github/workflows/pages.yml` | Test, build, deploy |
| `docs/superpowers/specs/variant-prompt.md` | The prompt every generating model receives |

---

### Task 1: Registry validation

**Files:**
- Create: `package.json`
- Create: `scripts/lib/registry.mjs`
- Create: `tests/registry.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `RESERVED_NAMES: string[]` (ids a variant may not use), `RESERVED_VARIANT_ENTRIES: string[]` (the same list without `index.html`, for entries inside a variant folder), `ID_PATTERN: RegExp`, `validateRegistry(registry, context) -> string[]` where `registry` is the parsed `variants.json` object, `context` is `{ variantFolders: string[], defaultTopLevelEntries: string[] }`, and the return value is an array of human-readable error messages, empty when valid.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "personal-website",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test \"tests/**/*.test.mjs\"",
    "test:e2e": "playwright test",
    "build": "node scripts/build.mjs",
    "serve": "node scripts/serve.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "marked": "^15.0.0"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/registry.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRegistry, ID_PATTERN, RESERVED_NAMES, RESERVED_VARIANT_ENTRIES } from '../scripts/lib/registry.mjs'

const entry = (over = {}) => ({
  id: 'claude-opus-5',
  label: 'Claude Opus 5',
  tool: 'Claude Code',
  toolVersion: '2.1.0',
  modelId: 'claude-opus-5',
  generatedAt: '2026-10-01',
  specVersion: '2026-10-01',
  attempts: 1,
  ...over,
})

const registry = (over = {}) => ({
  default: 'claude-opus-5',
  variants: [entry()],
  contact: { linkedin: 'https://www.linkedin.com/in/marioerazo/', github: 'https://github.com/MarioAer' },
  ...over,
})

const context = (over = {}) => ({ variantFolders: ['claude-opus-5'], defaultTopLevelEntries: ['index.html', 'style.css'], ...over })

test('a well-formed registry produces no errors', () => {
  assert.deepEqual(validateRegistry(registry(), context()), [])
})

test('the default must name an existing variant', () => {
  const errors = validateRegistry(registry({ default: 'missing' }), context())
  assert.equal(errors.length, 1)
  assert.match(errors[0], /default/)
  assert.match(errors[0], /missing/)
})

test('duplicate ids are rejected', () => {
  const r = registry({ variants: [entry(), entry()] })
  const errors = validateRegistry(r, context())
  assert.ok(errors.some((e) => /duplicate/i.test(e) && e.includes('claude-opus-5')))
})

test('an id that breaks the pattern is rejected', () => {
  const r = registry({ default: 'Claude_5', variants: [entry({ id: 'Claude_5' })] })
  const errors = validateRegistry(r, context({ variantFolders: ['Claude_5'] }))
  assert.ok(errors.some((e) => /pattern/i.test(e)))
})

test('reserved ids are rejected', () => {
  for (const name of ['shell', 'spec']) {
    const r = registry({ default: name, variants: [entry({ id: name })] })
    const errors = validateRegistry(r, context({ variantFolders: [name] }))
    assert.ok(errors.some((e) => /reserved/i.test(e)), `${name} should be reserved`)
  }
})

test('an id colliding with a top-level entry of the default variant is rejected', () => {
  const r = registry({ variants: [entry(), entry({ id: 'style.css' })] })
  const errors = validateRegistry(r, context({ variantFolders: ['claude-opus-5', 'style.css'] }))
  assert.ok(errors.some((e) => /collides/i.test(e) && e.includes('style.css')))
})

test('a missing required field is reported with the field name', () => {
  const broken = entry()
  delete broken.modelId
  const errors = validateRegistry(registry({ variants: [broken] }), context())
  assert.ok(errors.some((e) => e.includes('modelId')))
})

test('a folder without a registry entry is reported', () => {
  const errors = validateRegistry(registry(), context({ variantFolders: ['claude-opus-5', 'orphan'] }))
  assert.ok(errors.some((e) => e.includes('orphan')))
})

test('a registry entry without a folder is reported', () => {
  const errors = validateRegistry(registry(), context({ variantFolders: [] }))
  assert.ok(errors.some((e) => e.includes('claude-opus-5') && /folder/i.test(e)))
})

test('contact links must be https urls', () => {
  const r = registry({ contact: { linkedin: 'http://example.com', github: 'https://github.com/MarioAer' } })
  assert.ok(validateRegistry(r, context()).some((e) => /contact/i.test(e)))
})

test('the exported pattern and reserved lists are usable by other modules', () => {
  assert.ok(ID_PATTERN.test('claude-opus-5'))
  assert.ok(RESERVED_NAMES.includes('variants.json'))
  assert.ok(RESERVED_NAMES.includes('index.html'))
  assert.ok(!RESERVED_VARIANT_ENTRIES.includes('index.html'))
  assert.ok(RESERVED_VARIANT_ENTRIES.includes('shell'))
})
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '../scripts/lib/registry.mjs'`.

- [ ] **Step 4: Implement the module**

Create `scripts/lib/registry.mjs`:

```js
export const ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/
export const RESERVED_NAMES = ['shell', 'spec', 'index.html', '404.html', 'variants.json', 'cname', '.nojekyll']
// Entries a variant folder may not contain. index.html is absent: every variant must have one.
export const RESERVED_VARIANT_ENTRIES = RESERVED_NAMES.filter((name) => name !== 'index.html')

const REQUIRED_FIELDS = ['id', 'label', 'tool', 'toolVersion', 'modelId', 'generatedAt', 'specVersion']

export function validateRegistry(registry, context = {}) {
  const { variantFolders = [], defaultTopLevelEntries = [] } = context
  const errors = []

  if (!registry || typeof registry !== 'object') return ['variants.json: the registry must be an object']
  if (!Array.isArray(registry.variants) || registry.variants.length === 0) {
    errors.push('variants.json: "variants" must be a non-empty array')
    return errors
  }

  const seen = new Set()
  for (const [index, variant] of registry.variants.entries()) {
    const where = `variants[${index}]`
    for (const field of REQUIRED_FIELDS) {
      if (typeof variant?.[field] !== 'string' || variant[field].length === 0) {
        errors.push(`${where}: "${field}" is required and must be a non-empty string`)
      }
    }
    if (!Number.isInteger(variant?.attempts) || variant.attempts < 1) {
      errors.push(`${where}: "attempts" must be an integer of at least 1`)
    }
    const id = variant?.id
    if (typeof id !== 'string') continue
    if (!ID_PATTERN.test(id)) errors.push(`${where}: id "${id}" does not match the pattern ${ID_PATTERN}`)
    if (RESERVED_NAMES.includes(id.toLowerCase())) errors.push(`${where}: id "${id}" is a reserved name`)
    if (seen.has(id)) errors.push(`${where}: duplicate id "${id}"`)
    seen.add(id)
    if (!variantFolders.includes(id)) errors.push(`${where}: id "${id}" has no folder at variants/${id}`)
  }

  if (typeof registry.default !== 'string' || !seen.has(registry.default)) {
    errors.push(`variants.json: "default" must name a registered variant, found "${registry.default}"`)
  }

  for (const id of seen) {
    if (id !== registry.default && defaultTopLevelEntries.includes(id)) {
      errors.push(`variants.json: id "${id}" collides with a top-level entry of the default variant`)
    }
  }

  for (const folder of variantFolders) {
    if (!seen.has(folder)) errors.push(`variants/${folder}: folder has no entry in variants.json`)
  }

  const contact = registry.contact
  if (!contact || typeof contact !== 'object') {
    errors.push('variants.json: "contact" must be an object with linkedin and github')
  } else {
    for (const key of ['linkedin', 'github']) {
      const value = contact[key]
      if (typeof value !== 'string' || !value.startsWith('https://')) {
        errors.push(`variants.json: contact.${key} must be an https URL`)
      }
    }
  }

  return errors
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/lib/registry.mjs tests/registry.test.mjs
git commit -m "chore: add registry validation with tests"
```

---
### Task 2: Variant contract checks

**Files:**
- Create: `scripts/lib/contract.mjs`
- Create: `tests/contract.test.mjs`

**Interfaces:**
- Consumes: `RESERVED_VARIANT_ENTRIES` from `scripts/lib/registry.mjs`.
- Produces: `checkVariant({ id, files }) -> { errors: string[], warnings: string[] }`. `files` is a `Map` from a path relative to the variant folder (POSIX separators, for example `index.html`, `assets/style.css`) to the file's text, or `null` for a binary file.

- [ ] **Step 1: Write the failing test**

Create `tests/contract.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { checkVariant } from '../scripts/lib/contract.mjs'

const SHELL = '<script type="module" src="/shell/shell.js"></script>'

const page = (body = '', head = SHELL, meta = '<meta name="variant" content="demo">') =>
  `<!doctype html><html><head>${meta}${head}</head><body>${body}</body></html>`

const run = (files) => checkVariant({ id: 'demo', files: new Map(Object.entries(files)) })

test('a minimal valid variant passes', () => {
  const result = run({ 'index.html': page('<img src="./a.png" alt="a">'), 'a.png': null })
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.warnings, [])
})

test('a missing index.html is an error', () => {
  assert.ok(run({ 'style.css': 'body{}' }).errors.some((e) => /index\.html/.test(e)))
})

test('a missing or wrong variant meta tag is an error', () => {
  assert.ok(run({ 'index.html': page('', SHELL, '') }).errors.some((e) => /meta name="variant"/.test(e)))
  const wrong = page('', SHELL, '<meta name="variant" content="other">')
  assert.ok(run({ 'index.html': wrong }).errors.some((e) => /other/.test(e)))
})

test('the shell script tag is accepted with single quotes and reordered attributes', () => {
  const tag = "<script src='/shell/shell.js' type='module'></script>"
  assert.deepEqual(run({ 'index.html': page('', tag) }).errors, [])
})

test('a missing shell script tag is an error', () => {
  assert.ok(run({ 'index.html': page('', '') }).errors.some((e) => /shell\.js/.test(e)))
})

test('two shell script tags are an error', () => {
  assert.ok(run({ 'index.html': page('', SHELL + SHELL) }).errors.some((e) => /exactly one/.test(e)))
})

test('a shell script tag outside head is an error', () => {
  const html = `<!doctype html><html><head><meta name="variant" content="demo"></head><body>${SHELL}</body></html>`
  assert.ok(run({ 'index.html': html }).errors.some((e) => /head/.test(e)))
})

test('data and blob URIs and fragments are allowed', () => {
  const body = '<img src="data:image/gif;base64,R0lGOD" alt="x"><a href="#main">skip</a>'
  assert.deepEqual(run({ 'index.html': page(body) }).errors, [])
})

test('a parent-relative path is an error', () => {
  assert.ok(run({ 'index.html': page('<img src="../x.png" alt="x">') }).errors.some((e) => /\.\./.test(e)))
})

test('an absolute path other than the shell script is an error', () => {
  assert.ok(run({ 'index.html': page('<img src="/x.png" alt="x">') }).errors.some((e) => /\/x\.png/.test(e)))
})

test('an external stylesheet or font is an error', () => {
  const head = SHELL + '<link rel="stylesheet" href="https://fonts.example/x.css">'
  assert.ok(run({ 'index.html': page('', head) }).errors.some((e) => /fonts\.example/.test(e)))
})

test('an external anchor is allowed but mailto and tel are not', () => {
  assert.deepEqual(run({ 'index.html': page('<a href="https://example.com">x</a>') }).errors, [])
  assert.ok(run({ 'index.html': page('<a href="mailto:a@b.c">x</a>') }).errors.some((e) => /mailto/.test(e)))
  assert.ok(run({ 'index.html': page('<a href="tel:+49">x</a>') }).errors.some((e) => /tel/.test(e)))
})

test('css url() and @import are checked in stylesheets and inline styles', () => {
  const files = { 'index.html': page(), 'style.css': '@import url("https://x.example/a.css");' }
  assert.ok(run(files).errors.some((e) => /style\.css/.test(e)))
  const inline = page('', SHELL + '<style>body{background:url(/bg.png)}</style>')
  assert.ok(run({ 'index.html': inline }).errors.some((e) => /bg\.png/.test(e)))
})

test('srcset and xlink:href are checked', () => {
  assert.ok(run({ 'index.html': page('<img srcset="/a.png 1x" src="./a.png" alt="a">') }).errors.some((e) => /a\.png/.test(e)))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="/sprite.svg#a"/></svg>'
  assert.ok(run({ 'index.html': page(), 'icon.svg': svg }).errors.some((e) => /sprite\.svg/.test(e)))
})

test('an absolute path in variant javascript is a warning, not an error', () => {
  const result = run({ 'index.html': page(), 'app.js': 'fetch("/data.json")' })
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((w) => /data\.json/.test(w)))
})

test('a protocol-relative url in javascript is not warned about', () => {
  assert.deepEqual(run({ 'index.html': page(), 'app.js': 'const u = "//example.com/a"' }).warnings, [])
})

test('a reserved top-level entry is an error', () => {
  assert.ok(run({ 'index.html': page(), 'shell': null }).errors.some((e) => /reserved/.test(e)))
})
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '../scripts/lib/contract.mjs'`.

- [ ] **Step 3: Implement the module**

Create `scripts/lib/contract.mjs`:

```js
import { RESERVED_VARIANT_ENTRIES } from './registry.mjs'

const SHELL_SRC = '/shell/shell.js'
const SCRIPT_TAG = /<script\b[^>]*>/gi
const ATTR = /\b(src|href|srcset|poster|data|xlink:href)\s*=\s*("([^"]*)"|'([^']*)')/gi
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]+))\s*\)/gi
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/gi
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const STYLE_ATTR = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
const JS_ABSOLUTE = /(?:"|')(\/(?!\/)[^"'\s]*)(?:"|')/g
const ALLOWED_PREFIXES = ['data:', 'blob:', '#']

const attrValue = (match) => match[3] ?? match[4] ?? ''

function classify(value) {
  const v = value.trim()
  if (v === '') return 'ok'
  if (ALLOWED_PREFIXES.some((p) => v.startsWith(p))) return 'ok'
  if (v.startsWith('//')) return 'external'
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v.toLowerCase().startsWith('https:') ? 'https' : 'scheme'
  if (v.startsWith('/')) return 'absolute'
  if (v.split('/').includes('..')) return 'parent'
  return 'ok'
}

function checkReference(value, { where, isAnchor, errors }) {
  for (const candidate of String(value).split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean)) {
    const kind = classify(candidate)
    if (kind === 'ok') continue
    if (kind === 'absolute' && candidate === SHELL_SRC) continue
    if (kind === 'https' && isAnchor) continue
    if (kind === 'parent') errors.push(`${where}: "${candidate}" uses a parent-relative path; references must stay inside the variant folder`)
    else if (kind === 'absolute') errors.push(`${where}: "${candidate}" is an absolute path; only ${SHELL_SRC} may be absolute`)
    else if (kind === 'scheme') errors.push(`${where}: "${candidate}" uses a forbidden scheme; only https links in <a href> are allowed`)
    else errors.push(`${where}: "${candidate}" is an external URL; variants must carry their own assets`)
  }
}

function checkCss(text, where, errors) {
  for (const pattern of [CSS_URL, CSS_IMPORT]) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[3] ?? ''
      checkReference(value, { where, isAnchor: false, errors })
    }
  }
}

export function checkVariant({ id, files }) {
  const errors = []
  const warnings = []
  const html = files.get('index.html')

  for (const path of files.keys()) {
    const top = path.split('/')[0]
    if (RESERVED_VARIANT_ENTRIES.includes(top.toLowerCase())) {
      errors.push(`variants/${id}/${top}: "${top}" is a reserved name and must not appear in a variant`)
    }
  }

  if (typeof html !== 'string') {
    errors.push(`variants/${id}: index.html is missing`)
    return { errors, warnings }
  }

  const metaMatch = html.match(/<meta\b[^>]*name\s*=\s*["']variant["'][^>]*>/i)
  const metaContent = metaMatch?.[0].match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  const declared = metaContent?.[1] ?? metaContent?.[2]
  if (!declared) errors.push(`variants/${id}/index.html: <meta name="variant" content="${id}"> is missing`)
  else if (declared !== id) errors.push(`variants/${id}/index.html: the variant meta tag declares "${declared}" but the folder is "${id}"`)

  const shellTags = [...html.matchAll(SCRIPT_TAG)].filter((m) => m[0].includes(SHELL_SRC))
  if (shellTags.length !== 1) {
    errors.push(`variants/${id}/index.html: expected exactly one script tag loading ${SHELL_SRC}, found ${shellTags.length}`)
  } else {
    const headEnd = html.toLowerCase().indexOf('</head>')
    if (headEnd === -1 || shellTags[0].index > headEnd) {
      errors.push(`variants/${id}/index.html: the shell script tag must be inside <head>`)
    }
    if (!/type\s*=\s*(?:"module"|'module')/i.test(shellTags[0][0])) {
      errors.push(`variants/${id}/index.html: the shell script tag must have type="module"`)
    }
  }

  for (const [path, text] of files) {
    if (typeof text !== 'string') continue
    const where = `variants/${id}/${path}`
    if (path.endsWith('.html') || path.endsWith('.svg')) {
      for (const match of text.matchAll(ATTR)) {
        const tag = text.slice(Math.max(0, match.index - 200), match.index).match(/<([a-z0-9-]+)(?![\s\S]*<[a-z0-9-]+)/i)
        checkReference(attrValue(match), { where, isAnchor: (tag?.[1] ?? '').toLowerCase() === 'a', errors })
      }
      for (const block of text.matchAll(STYLE_BLOCK)) checkCss(block[1], where, errors)
      for (const attr of text.matchAll(STYLE_ATTR)) checkCss(attr[1] ?? attr[2] ?? '', where, errors)
    }
    if (path.endsWith('.css')) checkCss(text, where, errors)
    if (path.endsWith('.js')) {
      for (const match of text.matchAll(JS_ABSOLUTE)) {
        warnings.push(`${where}: the string "${match[1]}" looks like an absolute path; variant scripts must resolve assets relative to document.baseURI`)
      }
    }
  }

  return { errors, warnings }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, all registry and contract tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/contract.mjs tests/contract.test.mjs
git commit -m "chore: add variant contract checks with tests"
```

---
### Task 3: Specification page renderer

**Files:**
- Create: `scripts/lib/render-spec.mjs`
- Create: `tests/render-spec.test.mjs`

**Interfaces:**
- Consumes: `marked` from node_modules.
- Produces: `renderSpecPage(markdown, { basePath, title }) -> string`, a complete HTML document. `basePath` always ends with `/`; the caller normalises it (Task 4).

- [ ] **Step 1: Install the dependency**

Run: `npm install`
Expected: `marked` and `@playwright/test` present in `node_modules`, `package-lock.json` created.

- [ ] **Step 2: Write the failing test**

Create `tests/render-spec.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderSpecPage } from '../scripts/lib/render-spec.mjs'

const markdown = '# Title\n\nA paragraph with `code`.\n\n- one\n- two\n'

test('the page contains the rendered markdown', () => {
  const html = renderSpecPage(markdown, { basePath: '/', title: 'Specification' })
  assert.match(html, /<h1[^>]*>Title<\/h1>/)
  assert.match(html, /<li>one<\/li>/)
  assert.match(html, /<code>code<\/code>/)
})

test('the page loads the shell from the base path', () => {
  const html = renderSpecPage(markdown, { basePath: '/personal-website/', title: 'Specification' })
  assert.match(html, /<script type="module" src="\/personal-website\/shell\/shell\.js"><\/script>/)
})

test('the page declares the document title and language', () => {
  const html = renderSpecPage(markdown, { basePath: '/', title: 'Specification' })
  assert.match(html, /<html lang="en">/)
  assert.match(html, /<title>Specification<\/title>/)
})

test('the page offsets its content by the shell height and styles both themes', () => {
  const html = renderSpecPage(markdown, { basePath: '/', title: 'Specification' })
  assert.match(html, /var\(--shell-height, 56px\)/)
  assert.match(html, /prefers-color-scheme: dark/)
  assert.match(html, /\[data-theme="dark"\]/)
})

test('rendering is deterministic', () => {
  const a = renderSpecPage(markdown, { basePath: '/', title: 'Specification' })
  const b = renderSpecPage(markdown, { basePath: '/', title: 'Specification' })
  assert.equal(a, b)
})
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '../scripts/lib/render-spec.mjs'`.

- [ ] **Step 4: Implement the module**

Create `scripts/lib/render-spec.mjs`:

```js
import { marked } from 'marked'

const STYLE = `
:root { color-scheme: light dark; --bg: #fbfaf8; --fg: #1b1b1a; --muted: #5d5d58; --rule: #e2e0da; --accent: #b4441f; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #14140f; --fg: #eceadf; --muted: #a3a099; --rule: #2d2d26; --accent: #e07a4f; } }
:root[data-theme="dark"] { --bg: #14140f; --fg: #eceadf; --muted: #a3a099; --rule: #2d2d26; --accent: #e07a4f; }
* { box-sizing: border-box; }
body { margin: 0; padding-top: var(--shell-height, 56px); background: var(--bg); color: var(--fg);
  font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1rem 6rem; }
h1, h2, h3 { line-height: 1.25; margin: 2.5rem 0 0.75rem; }
h1 { font-size: 2rem; margin-top: 0; }
h2 { font-size: 1.4rem; border-bottom: 1px solid var(--rule); padding-bottom: 0.3rem; }
h3 { font-size: 1.1rem; }
a { color: var(--accent); }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
pre { overflow-x: auto; padding: 1rem; background: color-mix(in srgb, var(--fg) 6%, transparent); border-radius: 6px; }
table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
th, td { border: 1px solid var(--rule); padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
th { background: color-mix(in srgb, var(--fg) 5%, transparent); }
blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid var(--rule); color: var(--muted); }
`.trim()

export function renderSpecPage(markdown, { basePath, title }) {
  const body = marked.parse(markdown, { async: false, gfm: true, breaks: false })
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script type="module" src="${basePath}shell/shell.js"></script>
<style>
${STYLE}
</style>
</head>
<body>
<main>
${body.trim()}
</main>
</body>
</html>
`
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package-lock.json scripts/lib/render-spec.mjs tests/render-spec.test.mjs
git commit -m "chore: render the specification into a page at build time"
```

---
### Task 4: Build script

**Files:**
- Create: `scripts/build.mjs`
- Create: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `validateRegistry` from `scripts/lib/registry.mjs`, `checkVariant` from `scripts/lib/contract.mjs`, `renderSpecPage` from `scripts/lib/render-spec.mjs`.
- Produces: `normaliseBasePath(value) -> string` (always starts and ends with `/`), and `build({ root, outDir, basePath, siteDomain, specPath }) -> Promise<{ warnings: string[] }>`. `build` throws an `Error` whose message lists every validation failure. When `scripts/build.mjs` is executed directly it reads `BASE_PATH` and `SITE_DOMAIN` from the environment, resolves `root` to the repository root, `outDir` to `dist`, and `specPath` to the single file in `docs/superpowers/specs/` whose name ends with `-personal-website-design.md`.

- [ ] **Step 1: Write the failing test**

Create `tests/build.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, normaliseBasePath } from '../scripts/build.mjs'

const SHELL = '<script type="module" src="/shell/shell.js"></script>'

const variantHtml = (id) =>
  `<!doctype html><html lang="en"><head><meta name="variant" content="${id}">${SHELL}</head><body><h1>${id}</h1></body></html>`

async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pw-build-'))
  const registry = {
    default: 'alpha',
    variants: [
      { id: 'alpha', label: 'Alpha', tool: 'Claude Code', toolVersion: '1.0.0', modelId: 'alpha-1', generatedAt: '2026-10-01', specVersion: '2026-10-01', attempts: 1 },
      { id: 'beta', label: 'Beta', tool: 'Claude Code', toolVersion: '1.0.0', modelId: 'beta-1', generatedAt: '2026-09-01', specVersion: '2026-09-01', attempts: 1 },
    ],
    contact: { linkedin: 'https://www.linkedin.com/in/marioerazo/', github: 'https://github.com/MarioAer' },
    ...overrides.registry,
  }
  for (const id of ['alpha', 'beta']) {
    await mkdir(join(root, 'variants', id), { recursive: true })
    await writeFile(join(root, 'variants', id, 'index.html'), variantHtml(id))
  }
  await mkdir(join(root, 'shell'), { recursive: true })
  await writeFile(join(root, 'shell', 'shell.js'), '// shell\n')
  await mkdir(join(root, 'docs', 'superpowers', 'specs'), { recursive: true })
  await writeFile(join(root, 'docs', 'superpowers', 'specs', '2026-10-01-personal-website-design.md'), '# Spec\n\nText.\n')
  await writeFile(join(root, 'variants.json'), overrides.registryText ?? JSON.stringify(registry, null, 2))
  return root
}

const run = (root, options = {}) =>
  build({
    root,
    outDir: join(root, 'dist'),
    specPath: join(root, 'docs', 'superpowers', 'specs', '2026-10-01-personal-website-design.md'),
    basePath: '/',
    ...options,
  })

async function hashTree(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true })
  const parts = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) parts.push(await hashTree(path, `${prefix}${entry.name}/`))
    else parts.push(`${prefix}${entry.name}:${createHash('sha256').update(await readFile(path)).digest('hex')}`)
  }
  return parts.join('\n')
}

test('normaliseBasePath adds the missing slashes', () => {
  assert.equal(normaliseBasePath(undefined), '/')
  assert.equal(normaliseBasePath(''), '/')
  assert.equal(normaliseBasePath('/personal-website'), '/personal-website/')
  assert.equal(normaliseBasePath('personal-website'), '/personal-website/')
  assert.equal(normaliseBasePath('/personal-website/'), '/personal-website/')
})

test('the build produces the expected layout', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  const dist = join(root, 'dist')
  for (const path of ['index.html', 'alpha/index.html', 'beta/index.html', 'shell/shell.js', 'variants.json', 'spec/index.html', '404.html', '.nojekyll']) {
    await assert.doesNotReject(readFile(join(dist, path)), `${path} should exist`)
  }
  const rootPage = await readFile(join(dist, 'index.html'), 'utf8')
  assert.match(rootPage, /content="alpha"/)
})

test('the shell path is rewritten for both base paths', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root, { basePath: '/' })
  assert.match(await readFile(join(root, 'dist', 'alpha', 'index.html'), 'utf8'), /src="\/shell\/shell\.js"/)
  await run(root, { basePath: '/personal-website' })
  const page = await readFile(join(root, 'dist', 'alpha', 'index.html'), 'utf8')
  assert.match(page, /src="\/personal-website\/shell\/shell\.js"/)
  assert.doesNotMatch(page, /personal-websiteshell/)
  assert.match(await readFile(join(root, 'dist', '404.html'), 'utf8'), /src="\/personal-website\/shell\/shell\.js"/)
})

test('the output registry carries the current specification version', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  const out = JSON.parse(await readFile(join(root, 'dist', 'variants.json'), 'utf8'))
  assert.equal(out.specVersion, '2026-10-01')
  assert.equal(out.variants.length, 2)
})

test('CNAME is written only when a domain is given', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  await assert.rejects(readFile(join(root, 'dist', 'CNAME')))
  await run(root, { siteDomain: 'example.com' })
  assert.equal((await readFile(join(root, 'dist', 'CNAME'), 'utf8')).trim(), 'example.com')
})

test('the build is deterministic', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  const first = await hashTree(join(root, 'dist'))
  await run(root)
  assert.equal(await hashTree(join(root, 'dist')), first)
})

test('a stale output file is removed by the next build', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  await writeFile(join(root, 'dist', 'stale.txt'), 'x')
  await run(root)
  await assert.rejects(readFile(join(root, 'dist', 'stale.txt')))
})

test('a registry error fails the build with a readable message', async (t) => {
  const root = await fixture({ registry: { default: 'missing' } })
  t.after(() => rm(root, { recursive: true, force: true }))
  await assert.rejects(run(root), /default/)
})

test('malformed registry JSON fails with the file name and no stack trace noise', async (t) => {
  const root = await fixture({ registryText: '{ "default": ' })
  t.after(() => rm(root, { recursive: true, force: true }))
  await assert.rejects(run(root), /variants\.json/)
})

test('a contract violation fails the build naming the variant', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'variants', 'beta', 'index.html'), variantHtml('beta').replace('<body>', '<body><img src="/x.png" alt="x">'))
  await assert.rejects(run(root), /beta/)
})

test('a contract warning is returned, not thrown', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'variants', 'beta', 'app.js'), 'fetch("/data.json")')
  const result = await run(root)
  assert.ok(result.warnings.some((w) => /data\.json/.test(w)))
})
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '../scripts/build.mjs'`.

- [ ] **Step 3: Implement the build script**

Create `scripts/build.mjs`:

```js
import { readFile, writeFile, readdir, mkdir, rm, cp } from 'node:fs/promises'
import { join, relative, sep, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRegistry } from './lib/registry.mjs'
import { checkVariant } from './lib/contract.mjs'
import { renderSpecPage } from './lib/render-spec.mjs'

const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.json', '.txt', '.md'])

export function normaliseBasePath(value) {
  const raw = (value ?? '').trim()
  if (raw === '' || raw === '/') return '/'
  return `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}/`
}

async function listFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(path, `${prefix}${entry.name}/`)))
    else files.push({ absolute: path, relative: `${prefix}${entry.name}` })
  }
  return files
}

async function readVariantFiles(dir) {
  const files = new Map()
  for (const file of await listFiles(dir)) {
    const extension = file.relative.slice(file.relative.lastIndexOf('.'))
    files.set(file.relative, TEXT_EXTENSIONS.has(extension) ? await readFile(file.absolute, 'utf8') : null)
  }
  return files
}

async function listVariantFolders(root) {
  try {
    const entries = await readdir(join(root, 'variants'), { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  } catch {
    return []
  }
}

function rewriteShellPath(html, basePath) {
  return html.replace(/(<script\b[^>]*\bsrc\s*=\s*["'])\/shell\/shell\.js(["'])/gi, `$1${basePath}shell/shell.js$2`)
}

export async function build({ root, outDir, basePath, siteDomain, specPath }) {
  const base = normaliseBasePath(basePath)
  const registryPath = join(root, 'variants.json')

  let registry
  try {
    registry = JSON.parse(await readFile(registryPath, 'utf8'))
  } catch (cause) {
    throw new Error(`variants.json could not be read as JSON: ${cause.message}`)
  }

  const variantFolders = await listVariantFolders(root)
  const defaultTopLevelEntries = registry?.default && variantFolders.includes(registry.default)
    ? (await readdir(join(root, 'variants', registry.default))).sort()
    : []

  const registryErrors = validateRegistry(registry, { variantFolders, defaultTopLevelEntries })
  if (registryErrors.length > 0) throw new Error(`The registry is invalid:\n  ${registryErrors.join('\n  ')}`)

  const warnings = []
  for (const variant of registry.variants) {
    const files = await readVariantFiles(join(root, 'variants', variant.id))
    const result = checkVariant({ id: variant.id, files })
    if (result.errors.length > 0) throw new Error(`Variant "${variant.id}" breaks the contract:\n  ${result.errors.join('\n  ')}`)
    warnings.push(...result.warnings)
  }

  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  await cp(join(root, 'variants', registry.default), outDir, { recursive: true })
  for (const variant of registry.variants) {
    await cp(join(root, 'variants', variant.id), join(outDir, variant.id), { recursive: true })
  }

  for (const file of await listFiles(outDir)) {
    if (!file.relative.endsWith('.html')) continue
    const html = await readFile(file.absolute, 'utf8')
    const rewritten = rewriteShellPath(html, base)
    if (rewritten !== html) await writeFile(file.absolute, rewritten)
  }

  await cp(join(root, 'shell'), join(outDir, 'shell'), { recursive: true })

  const specVersion = basename(specPath).slice(0, 10)
  await writeFile(join(outDir, 'variants.json'), `${JSON.stringify({ ...registry, specVersion }, null, 2)}\n`)

  await mkdir(join(outDir, 'spec'), { recursive: true })
  const markdown = await readFile(specPath, 'utf8')
  await writeFile(join(outDir, 'spec', 'index.html'), renderSpecPage(markdown, { basePath: base, title: 'Specification' }))

  await writeFile(join(outDir, '.nojekyll'), '')
  await writeFile(join(outDir, '404.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found</title>
<script type="module" src="${base}shell/shell.js"></script>
<style>body{margin:0;padding-top:var(--shell-height,56px);font:16px/1.6 ui-sans-serif,system-ui,sans-serif}main{max-width:40rem;margin:0 auto;padding:3rem 1rem}</style>
</head>
<body>
<main>
<h1>Page not found</h1>
<p>Use the selector in the bar above to open one of the published versions of this site.</p>
</main>
</body>
</html>
`)

  if (siteDomain) await writeFile(join(outDir, 'CNAME'), `${siteDomain}\n`)

  return { warnings }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const specsDir = join(root, 'docs', 'superpowers', 'specs')
  const specFile = (await readdir(specsDir)).filter((name) => name.endsWith('-personal-website-design.md')).sort().at(-1)
  if (!specFile) throw new Error(`No specification found in ${relative(root, specsDir)}${sep}`)
  const { warnings } = await build({
    root,
    outDir: join(root, 'dist'),
    basePath: process.env.BASE_PATH,
    siteDomain: process.env.SITE_DOMAIN,
    specPath: join(specsDir, specFile),
  })
  for (const warning of warnings) console.warn(`warning: ${warning}`)
  console.log(`Built ${relative(root, join(root, 'dist'))} for base path ${normaliseBasePath(process.env.BASE_PATH)}`)
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build.mjs tests/build.test.mjs
git commit -m "chore: assemble the site with a dependency-free build script"
```

---
### Task 5: Shell and browser test harness

**Files:**
- Create: `scripts/serve.mjs`
- Create: `playwright.config.js`
- Create: `e2e/shell.spec.js`
- Create: `shell/shell.js`
- Create: `variants/fixture-a/index.html` and `variants/fixture-b/index.html` (temporary fixtures, deleted in Task 6)
- Modify: `variants.json`

**Interfaces:**
- Consumes: `dist/variants.json` and the `<meta name="variant">` tag, both produced by Task 4.
- Produces: the top bar. The e2e tests address it through `page.locator('site-shell')` and its shadow root; the elements carry `data-testid` attributes `shell-select`, `shell-theme`, `shell-spec`, `shell-linkedin`, `shell-github`, `shell-colophon`.

- [ ] **Step 1: Create the temporary fixtures and register them**

Create `variants/fixture-a/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="variant" content="fixture-a">
<title>Fixture A</title>
<script type="module" src="/shell/shell.js"></script>
<style>body{margin:0;padding-top:var(--shell-height,56px);font:16px/1.6 system-ui,sans-serif}</style>
</head>
<body>
<main><h1>Fixture A</h1></main>
</body>
</html>
```

Create `variants/fixture-b/index.html` with `fixture-b` in the meta tag, the title and the heading.

Create `variants.json`:

```json
{
  "default": "fixture-a",
  "variants": [
    { "id": "fixture-a", "label": "Fixture A", "tool": "Claude Code", "toolVersion": "0.0.0", "modelId": "fixture-a", "generatedAt": "2026-10-01", "specVersion": "2026-10-01", "attempts": 1 },
    { "id": "fixture-b", "label": "Fixture B", "tool": "Claude Code", "toolVersion": "0.0.0", "modelId": "fixture-b", "generatedAt": "2026-09-01", "specVersion": "2026-09-01", "attempts": 1 }
  ],
  "contact": {
    "linkedin": "https://www.linkedin.com/in/marioerazo/",
    "github": "https://github.com/MarioAer"
  }
}
```

- [ ] **Step 2: Write the static server**

Create `scripts/serve.mjs`:

```js
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normaliseBasePath } from './build.mjs'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
}

export function createStaticServer({ root, basePath }) {
  const base = normaliseBasePath(basePath)
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (!url.pathname.startsWith(base)) {
      response.writeHead(302, { location: base })
      response.end()
      return
    }
    let relativePath = normalize(decodeURIComponent(url.pathname.slice(base.length))).replace(/^(\.\.(\/|$))+/, '')
    let filePath = join(root, relativePath)
    try {
      if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      // fall through to the 404 handler
    }
    try {
      const body = await readFile(filePath)
      response.writeHead(200, { 'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      response.end(body)
    } catch {
      try {
        response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
        response.end(await readFile(join(root, '404.html')))
      } catch {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('Not found')
      }
    }
  })
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const port = Number(process.env.PORT ?? 4173)
  const root = join(fileURLToPath(new URL('..', import.meta.url)), 'dist')
  const base = normaliseBasePath(process.env.BASE_PATH)
  createStaticServer({ root, basePath: base }).listen(port, () => {
    console.log(`Serving dist at http://localhost:${port}${base}`)
  })
}
```

- [ ] **Step 3: Configure Playwright**

Create `playwright.config.js`:

```js
import { defineConfig, devices } from '@playwright/test'

const BASE_PATH = '/personal-website/'
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}${BASE_PATH}`, trace: 'retain-on-failure' },
  webServer: {
    command: `BASE_PATH=${BASE_PATH} npm run build && BASE_PATH=${BASE_PATH} PORT=${PORT} npm run serve`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-phone', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
    { name: 'webkit-phone', use: { ...devices['Desktop Safari'], viewport: { width: 360, height: 780 } } },
  ],
})
```

- [ ] **Step 4: Write the failing shell tests**

Create `e2e/shell.spec.js`:

```js
import { test, expect } from '@playwright/test'

const shell = (page) => page.locator('site-shell')
const control = (page, id) => shell(page).locator(`[data-testid="${id}"]`)

test('the bar appears on the default variant', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-select')).toBeVisible()
  await expect(control(page, 'shell-theme')).toBeVisible()
  await expect(control(page, 'shell-spec')).toBeVisible()
})

test('the selector shows the current variant and lists every entry', async ({ page }) => {
  await page.goto('fixture-b/')
  await expect(control(page, 'shell-select')).toHaveValue('fixture-b')
  await expect(control(page, 'shell-select').locator('option')).toHaveCount(2)
})

test('choosing a variant navigates to its path', async ({ page }) => {
  await page.goto('./')
  await control(page, 'shell-select').selectOption('fixture-b')
  await page.waitForURL('**/personal-website/fixture-b/')
  await expect(page.locator('h1')).toHaveText('Fixture B')
})

test('choosing the default variant navigates to the site root', async ({ page }) => {
  await page.goto('fixture-b/')
  await control(page, 'shell-select').selectOption('fixture-a')
  await page.waitForURL((url) => url.pathname === '/personal-website/')
})

test('the theme toggle writes and persists the theme', async ({ page }) => {
  await page.goto('./')
  await control(page, 'shell-theme').click()
  const theme = await page.locator('html').getAttribute('data-theme')
  expect(['light', 'dark']).toContain(theme)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
})

test('the theme toggle still works when storage throws', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage is blocked') },
    })
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(control(page, 'shell-theme')).toBeVisible()
  await control(page, 'shell-theme').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
  expect(errors).toEqual([])
})

test('the specification link opens the specification page', async ({ page }) => {
  await page.goto('./')
  await control(page, 'shell-spec').click()
  await page.waitForURL('**/personal-website/spec/')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(shell(page).locator('[data-testid="shell-select"]')).toBeVisible()
})

test('the colophon names the model and marks a stale variant', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-colophon')).toContainText('Fixture A')
  await page.goto('fixture-b/')
  await expect(control(page, 'shell-colophon')).toContainText('2026-09-01')
})

test('the bar works when the registry cannot be loaded', async ({ page }) => {
  await page.route('**/variants.json', (route) => route.abort())
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(control(page, 'shell-select')).toHaveCount(0)
  await expect(control(page, 'shell-theme')).toBeVisible()
  await expect(control(page, 'shell-github')).toBeVisible()
  expect(errors).toEqual([])
})

test('the 404 page carries the bar', async ({ page }) => {
  const response = await page.goto('no-such-page')
  expect(response.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Page not found')
  await expect(control(page, 'shell-github')).toBeVisible()
})
```

- [ ] **Step 5: Run the tests and watch them fail**

Run: `npx playwright install --with-deps && npm run test:e2e`
Expected: FAIL, the shell element is never found because `shell/shell.js` does not exist.

- [ ] **Step 6: Implement the shell**

Create `shell/shell.js`:

```js
const BASE = new URL('..', import.meta.url)
const VARIANT_ID = document.querySelector('meta[name="variant"]')?.content ?? ''
const STORAGE_KEY = 'theme'

const storage = {
  read() {
    try { return window.localStorage.getItem(STORAGE_KEY) } catch { return null }
  },
  write(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value) } catch { /* storage unavailable */ }
  },
}

function currentTheme() {
  const stored = storage.read()
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  storage.write(theme)
}

const STYLE = `
:host { all: initial; }
.bar { position: fixed; inset: 0 0 auto 0; z-index: 2147483000; display: flex; align-items: center; gap: 0.75rem;
  height: 56px; padding: 0 1rem; box-sizing: border-box; background: var(--bar-bg); color: var(--bar-fg);
  border-bottom: 1px solid var(--bar-rule); font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif; }
:host { --bar-bg: #fbfaf8; --bar-fg: #1b1b1a; --bar-rule: #e2e0da; --bar-muted: #5d5d58; }
:host([data-theme="dark"]) { --bar-bg: #14140f; --bar-fg: #eceadf; --bar-rule: #2d2d26; --bar-muted: #a3a099; }
a, button, select { font: inherit; color: inherit; }
.name { font-weight: 600; text-decoration: none; white-space: nowrap; }
.spacer { flex: 1 1 auto; }
.group { display: flex; align-items: center; gap: 0.4rem; }
.label { color: var(--bar-muted); white-space: nowrap; }
select, button, .link { background: transparent; border: 1px solid var(--bar-rule); border-radius: 6px;
  padding: 0.3rem 0.5rem; cursor: pointer; text-decoration: none; }
button:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.colophon { color: var(--bar-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 22rem; }
.stale { color: #b4441f; }
@media (max-width: 860px) { .label, .colophon { display: none; } }
@media (max-width: 480px) { .name { display: none; } }
svg { display: block; width: 18px; height: 18px; fill: currentColor; }
`.trim()

const ICONS = {
  linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.82-2.05 3.75-2.05 4 0 4.4 2.5 4.4 5.8V21h-4v-5.6c0-1.3-.02-3-1.9-3-1.9 0-2.2 1.4-2.2 2.9V21h-4V9Z"/>',
  github: '<path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
}

const icon = (name, title) =>
  `<svg viewBox="0 0 24 24" role="img" aria-label="${title}"><title>${title}</title>${ICONS[name]}</svg>`

function mount() {
  const host = document.createElement('site-shell')
  host.dataset.theme = currentTheme()
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>${STYLE}</style>
<div class="bar">
  <a class="name" href="${BASE.pathname}">Mario Erazo</a>
  <span class="colophon" data-testid="shell-colophon"></span>
  <span class="spacer"></span>
  <span class="group registry" hidden>
    <label class="label" for="variant-select">Built with</label>
    <select id="variant-select" data-testid="shell-select"></select>
  </span>
  <button type="button" data-testid="shell-theme" aria-label="Switch colour theme">Theme</button>
  <a class="link" data-testid="shell-spec" href="${BASE.pathname}spec/">View spec</a>
  <span class="group contact"></span>
</div>`

  document.body.prepend(host)
  document.documentElement.style.setProperty('--shell-height', '56px')
  applyTheme(currentTheme())

  root.querySelector('[data-testid="shell-theme"]').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    host.dataset.theme = next
  })

  return { host, root }
}

async function loadRegistry(root) {
  const response = await fetch(new URL('variants.json', BASE), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`variants.json responded with ${response.status}`)
  const registry = await response.json()

  const contact = root.querySelector('.contact')
  const links = [
    ['linkedin', 'LinkedIn', registry.contact?.linkedin],
    ['github', 'GitHub', registry.contact?.github],
  ]
  for (const [key, title, href] of links) {
    if (!href) continue
    const anchor = document.createElement('a')
    anchor.className = 'link'
    anchor.dataset.testid = `shell-${key}`
    anchor.href = href
    anchor.rel = 'me noopener'
    anchor.setAttribute('aria-label', title)
    anchor.innerHTML = icon(key, title)
    contact.append(anchor)
  }

  const entry = registry.variants.find((variant) => variant.id === VARIANT_ID)
  if (entry) {
    const stale = entry.specVersion !== registry.specVersion
    const colophon = root.querySelector('[data-testid="shell-colophon"]')
    colophon.textContent = `Built with ${entry.label}, ${entry.generatedAt}, spec ${entry.specVersion}${stale ? ' (older specification)' : ''}`
    if (stale) colophon.classList.add('stale')
  }

  const select = root.querySelector('[data-testid="shell-select"]')
  for (const variant of registry.variants) {
    const option = document.createElement('option')
    option.value = variant.id
    option.textContent = variant.label
    option.selected = variant.id === VARIANT_ID
    select.append(option)
  }
  select.addEventListener('change', () => {
    const target = select.value === registry.default ? BASE : new URL(`${select.value}/`, BASE)
    window.location.assign(target)
  })
  root.querySelector('.registry').hidden = false
}

const { root } = mount()
loadRegistry(root).catch(() => {
  root.querySelector('.registry')?.remove()
  const contact = root.querySelector('.contact')
  if (contact.children.length === 0) {
    const anchor = document.createElement('a')
    anchor.className = 'link'
    anchor.dataset.testid = 'shell-github'
    anchor.href = 'https://github.com/MarioAer'
    anchor.setAttribute('aria-label', 'GitHub')
    anchor.innerHTML = icon('github', 'GitHub')
    contact.append(anchor)
  }
})
```

- [ ] **Step 7: Run the browser tests and watch them pass**

Run: `npm run test:e2e`
Expected: PASS across all five projects.

- [ ] **Step 8: Run the unit tests to confirm nothing regressed**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add shell/shell.js scripts/serve.mjs playwright.config.js e2e/shell.spec.js variants.json variants/fixture-a variants/fixture-b
git commit -m "chore: add the shared top bar and the browser test harness"
```

---
### Task 6: The first variant

**Files:**
- Create: `docs/superpowers/specs/variant-prompt.md`
- Create: `e2e/content.spec.js`
- Create: `variants/claude-opus-5/` (generated, not hand-written)
- Modify: `variants.json`
- Delete: `variants/fixture-a/`, `variants/fixture-b/`

**Interfaces:**
- Consumes: the contract and the shell from Tasks 2 and 5; the content inventory in the specification.
- Produces: the default variant `claude-opus-5`, and a content test suite that every future variant must also pass.

- [ ] **Step 1: Write the generation prompt**

Create `docs/superpowers/specs/variant-prompt.md`:

```markdown
# Variant generation prompt

Written for the specification dated 2026-10-01.

You are implementing one version of a personal consulting website. The specification is the file
`docs/superpowers/specs/2026-10-01-personal-website-design.md`. Read it in full before writing anything.

Implement the sections titled "Positioning", "Content inventory" and "Design constraints for variants"
as a single self-contained folder at `variants/<ID>/`, obeying every rule in the section titled
"Variant contract".

Rules you must not break:

- Write only inside `variants/<ID>/`. Do not modify any other file.
- Plain HTML, CSS and optional vanilla JavaScript. No framework, no build step, no external URL for any
  script, style or font. Self-hosted or system fonts only.
- `index.html` contains `<meta name="variant" content="<ID>">` and exactly one
  `<script type="module" src="/shell/shell.js"></script>` in `<head>`. That is the only absolute path allowed.
- Every other reference is relative, a `data:` URI or a fragment. Links to LinkedIn or GitHub are not your
  concern: the shared bar renders them.
- Leave the top 56 px of the viewport free: `padding-top: var(--shell-height, 56px)` on `<body>` or equivalent.
- Style both themes. The bar sets `data-theme="light"` or `data-theme="dark"` on `<html>`; with no attribute,
  follow `prefers-color-scheme`.
- Every factual statement must come from the specification. Invent no roles, employers, dates, clients or numbers.
- The visual design is yours. The content and the constraints are not.

When you have finished, run `npm test` and `npm run build` and fix anything they report.
```

- [ ] **Step 2: Write the failing content tests**

Create `e2e/content.spec.js`:

```js
import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const registry = JSON.parse(await readFile(new URL('../variants.json', import.meta.url), 'utf8'))
const paths = ['./', ...registry.variants.map((variant) => `${variant.id}/`)]

const SERVICES = ['Solution architecture and integration', 'Interim and fractional engineering leadership', 'AI-assisted engineering enablement']

for (const path of paths) {
  test.describe(`variant at ${path}`, () => {
    test('has one h1, the landmarks and the required sections', async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('main')).toHaveCount(1)
      await expect(page.locator('footer')).toHaveCount(1)
      for (const service of SERVICES) {
        await expect(page.getByText(service, { exact: false }).first()).toBeVisible()
      }
    })

    test('states the positioning, the location and the availability', async ({ page }) => {
      await page.goto(path)
      const body = page.locator('body')
      await expect(body).toContainText('Cologne')
      await expect(body).toContainText(/Available for/i)
    })

    test('carries the evidence numbers exactly', async ({ page }) => {
      await page.goto(path)
      const text = await page.locator('body').innerText()
      for (const phrase of ['18 engineers', '32 services into 24', 'six weeks', '40 percent']) {
        expect(text).toContain(phrase)
      }
    })

    test('contains no job-seeking phrases and no personal contact data', async ({ page }) => {
      await page.goto(path)
      const text = (await page.locator('main').innerText()).toLowerCase()
      for (const phrase of ['looking for', 'open to work', 'seeking', 'hire me', 'résumé', 'curriculum vitae']) {
        expect(text).not.toContain(phrase)
      }
      await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0)
    })

    test('reaches LinkedIn and GitHub in one click', async ({ page }) => {
      await page.goto(path)
      const shell = page.locator('site-shell')
      await expect(shell.locator('[data-testid="shell-linkedin"]')).toBeVisible()
      await expect(shell.locator('[data-testid="shell-github"]')).toBeVisible()
    })

    test('does not scroll horizontally', async ({ page }) => {
      await page.goto(path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })

    test('clears the top bar', async ({ page }) => {
      await page.goto(path)
      const top = await page.locator('main').first().evaluate((node) => node.getBoundingClientRect().top + window.scrollY)
      expect(top).toBeGreaterThanOrEqual(56)
    })

    test('loads no third-party resource and logs no error', async ({ page }) => {
      const problems = []
      page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()) })
      page.on('pageerror', (error) => problems.push(error.message))
      page.on('requestfailed', (request) => problems.push(`failed request: ${request.url()}`))
      page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.hostname !== 'localhost' && url.protocol !== 'data:') problems.push(`third-party request: ${request.url()}`)
      })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(problems).toEqual([])
    })

    test('shows the services and one evidence sentence each within two screens', async ({ page }, testInfo) => {
      test.skip(testInfo.project.use.viewport.width < 1000, 'desktop criterion')
      await page.goto(path)
      for (const service of SERVICES) {
        const box = await page.getByText(service, { exact: false }).first().boundingBox()
        expect(box.y + (await page.evaluate(() => window.scrollY))).toBeLessThan(1800)
      }
    })
  })
}
```

- [ ] **Step 3: Run the content tests against the fixtures and watch them fail**

Run: `npm run test:e2e -- content`
Expected: FAIL, the fixture variants contain none of the required content.

- [ ] **Step 4: Generate the variant**

Dispatch one subagent with this prompt and nothing else from this plan:

> Read `docs/superpowers/specs/2026-10-01-personal-website-design.md` and `docs/superpowers/specs/variant-prompt.md`. Implement the variant with the id `claude-opus-5` at `variants/claude-opus-5/`, following the prompt exactly. Write only inside that folder. When you are done, report the files you created and nothing else.

- [ ] **Step 5: Register the variant and remove the fixtures**

Replace `variants.json` with:

```json
{
  "default": "claude-opus-5",
  "variants": [
    {
      "id": "claude-opus-5",
      "label": "Claude Opus 5",
      "tool": "Claude Code",
      "toolVersion": "2.1.0",
      "modelId": "claude-opus-5",
      "generatedAt": "2026-10-01",
      "specVersion": "2026-10-01",
      "attempts": 1
    }
  ],
  "contact": {
    "linkedin": "https://www.linkedin.com/in/marioerazo/",
    "github": "https://github.com/MarioAer"
  }
}
```

Run: `rm -rf variants/fixture-a variants/fixture-b`

Set `toolVersion` to the output of `claude --version`, and `generatedAt` to today's date.

- [ ] **Step 6: Run the whole suite**

Run: `npm test && npm run build && npm run test:e2e`
Expected: PASS. Any contract warning printed by the build is reported to the model from Step 4 and fixed there, not by hand.

- [ ] **Step 7: Review the variant against the specification**

Read `variants/claude-opus-5/index.html` and check, by eye, each row of the content inventory, the tone rules, and that no fact appears that the specification does not contain. Anything wrong goes back to the model from Step 4. Record any unavoidable manual edit in `variants/claude-opus-5/NOTES.md`.

- [ ] **Step 8: Commit**

```bash
git add variants.json variants/claude-opus-5 e2e/content.spec.js docs/superpowers/specs/variant-prompt.md
git rm -r --cached variants/fixture-a variants/fixture-b
git commit -m "chore: add the first generated variant and the content tests"
```

---

### Task 7: Continuous integration and deployment

**Files:**
- Create: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: `npm test`, `npm run build`, `npm run test:e2e`.
- Produces: a deployed site at `https://marioaer.github.io/personal-website/`.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - name: Build the site
        env:
          SITE_DOMAIN: ${{ vars.SITE_DOMAIN }}
        run: |
          if [ -n "$SITE_DOMAIN" ]; then
            BASE_PATH=/ npm run build
          else
            BASE_PATH="/${GITHUB_REPOSITORY#*/}/" npm run build
          fi
      - uses: actions/upload-pages-artifact@v3
        if: github.ref == 'refs/heads/main'
        with:
          path: dist

  deploy:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the workflow file parses**

Run: `node -e "require('node:fs').readFileSync('.github/workflows/pages.yml','utf8')" && npx --yes yaml-lint .github/workflows/pages.yml || true`
Expected: no error from the read; the linter is advisory.

- [ ] **Step 3: Run the full local verification one last time**

Run: `npm test && BASE_PATH=/personal-website/ npm run build && npm run test:e2e`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: build, test and deploy the site to github pages"
```

- [ ] **Step 5: Push and open the merge request**

```bash
git push -u origin chore/kickstart
gh pr create --base main --head chore/kickstart \
  --title "chore: kickstart the personal website" \
  --body "See docs/superpowers/plans/2026-10-01-personal-website-kickstart.md"
```

- [ ] **Step 6: Enable GitHub Pages**

In the repository settings, set Pages to deploy from GitHub Actions. This is a one-time manual step and
cannot be done from the plan. After the first deployment to `main`, the site is at
`https://marioaer.github.io/personal-website/`.
