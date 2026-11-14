# Legal Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a legal page (privacy notice, and a legal notice when a postal address is supplied), link it from the shell bar on every page, and stop writing to `localStorage` before the visitor uses the theme toggle.

**Architecture:** The page is build output, like `404.html`: a pure function in `scripts/lib/legal.ts` renders it from a new `legal` block in `variants.json`, and `build.ts` writes it to `dist/legal.html` with the security policy. The shell bar gets one static link to it, so no variant folder is touched. No cookie banner is built, because nothing needs consent once the theme is stored only on a click.

**Tech Stack:** Node 24 running TypeScript directly, Node's test runner, Playwright (CI only), plain JavaScript in `shell/shell.js`.

**Spec:** No design document exists. The decisions this plan rests on are listed under "Decisions and open points"; the owner confirms them by approving the plan.

## Decisions and open points

Mine, each open to correction before implementation:

1. One page, `legal.html`, with three sections: `#legal-notice` (rendered only when `legal.address` is present), `#privacy` (always) and `#sources` (always).
2. The owner's data lives in `variants.json` under `legal`: `name` and `email` required, `address` optional. The owner decides whether an Impressum is published by supplying the address or not.
3. The owner kept the email off the site to avoid bots; the postal address is not a concern, so the Impressum is published. The email is therefore a dedicated alias used only for this page (the owner creates it; it can be filtered or replaced), shown as text with no `mailto:` link and written in the page source as numeric character references, so a visitor reads it normally and a scraper matching address patterns in the source does not. It is not hidden behind an image or a script: a legal notice has to show the address directly.
4. Bar link text is `Legal`, accessible name `Legal notice and privacy`. `Impressum` is the more recognisable word in Germany; say so if you prefer it.
5. The page is in English, like the site.
6. The privacy copy in Task 3 is a draft. It is not legal advice and should be read by the owner, ideally a lawyer, before merge.
7. The page's wording is my own and the page cites its primary sources. Free template generators were not copied: their texts are German-only in the free version, licensed to the person who generates them, and require the generator's credit line.

The owner's, needed before Task 2 can finish:

- **Values:** the name, a contact email address and, for an Impressum, a postal address where documents can be served. A c/o or office address qualifies; a PO box alone does not.
- **Spec rule 4.2** forbids an email or postal address on the site. This plan treats the legal page as build output outside the specification's content inventory and records that in `AGENTS.md`. If the owner prefers a new specification version instead, that is a separate change and marks every variant as built from an older specification.

## Global Constraints

- No `any`, no `as` assertions; parsed JSON is `unknown` narrowed by guards. Imports carry `.ts`.
- No regular expression may contain `<`, `@import` or `url(`.
- Nothing under `variants/*/`, `spec/` or `dist/` is edited.
- Commit messages: `type: description`, lowercase, imperative, types `chore`, `ci`, `docs` only. One logical change per commit.
- Never run Playwright locally. Browser tests are written here and run by CI on the pull request; a browser test's "verify it fails" step is skipped and noted in the pull request.
- Local verification is `npm run typecheck`, `npm run lint`, `npm test`, `BASE_PATH=/personal-website/ npm run build`.
- Test fixtures use invented values only (`Ada Example`, `ada@example.org`, `1 Example Street`, `12345 Example City`). No real personal data in tests or in this plan.
- Output stays deterministic: identical inputs give a byte-identical `dist/`.

## Review Focus

1. A name, address line or email containing `<`, `&` or `"` must appear as text, not markup. Test in Task 3.
2. `legal.address` given as an empty array or with an empty line must fail the build, not render an empty Impressum. Test in Task 2.
3. A variant with the id or a top-level file named `legal.html` would be overwritten by the page; it must fail the build. Test in Task 4.
4. With the registry unreachable, the legal link must still be there. Test in Task 5.
5. At 360 px the bar gains one more control; the link must lie inside the viewport. Test in Task 5.

---

### Task 1: Store the theme only when the visitor uses the toggle

Today `mount()` calls `applyTheme(currentTheme())`, which writes `localStorage` on every page load. That write is not something the visitor asked for, and it freezes the system theme at the first visit.

**Files:**
- Modify: `shell/shell.js` (`applyTheme`, `mount`)
- Modify: `AGENTS.md` (Shell, item 3: the theme is stored when the toggle is used)
- Test: `e2e/shell.spec.ts`

- [ ] **Step 1: Write the browser test**, next to `the theme toggle writes and persists the theme`:

```ts
test('no theme is stored until the visitor uses the toggle', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-theme')).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBeNull()
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/)
  await control(page, 'shell-theme').click()
  expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toMatch(/^(light|dark)$/)
})
```

- [ ] **Step 2: Change `shell/shell.js`.** `applyTheme(theme)` sets `document.documentElement.dataset.theme` only. The click handler calls `applyTheme(next)` and then `storage.write(next)`. `mount()` keeps calling `applyTheme(currentTheme())`.
- [ ] **Step 3: Update the sentence in `AGENTS.md`.**
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `chore: store the theme only when the visitor uses the toggle`.

### Task 2: The `legal` block in the registry

**Files:**
- Modify: `scripts/lib/registry.ts`
- Modify: `scripts/build.ts` (the published registry omits `legal`)
- Modify: `variants.json` (the owner's values)
- Modify: `tests/build.test.ts` (fixture registry gains a `legal` block), `e2e/shell.spec.ts` only if a mock registry there fails typing
- Modify: `AGENTS.md` (Registry: example and rules)
- Test: `tests/registry.test.ts`

**Interfaces:**
- Produces:

```ts
/** Who answers for the site. `address` present means a legal notice is published. */
export interface Legal { name: string; email: string; address?: string[] }
export interface Registry { /* existing fields */ legal: Legal }
```

- [ ] **Step 1: Write the failing tests.** Add `legal: { name: 'Ada Example', email: 'ada@example.org' }` to the `registry()` helper, then:

```ts
const legalErrors = (legal: unknown): string[] => validateRegistry(registry({ legal }), context())

test('a legal block needs a name and an email address', () => {
  assert.ok(legalErrors(undefined).some((e) => e.includes('"legal"')))
  assert.ok(legalErrors({ email: 'ada@example.org' }).some((e) => e.includes('legal.name')))
  for (const email of ['', 'ada', 'ada@', '@example.org', 'ada@example', 'a da@example.org', 'a@b@example.org']) {
    assert.ok(legalErrors({ name: 'Ada Example', email }).some((e) => e.includes('legal.email')), `"${email}" should be rejected`)
  }
})

test('a legal address is optional, but when present it is a list of non-empty lines', () => {
  assert.deepEqual(legalErrors({ name: 'Ada Example', email: 'ada@example.org', address: ['1 Example Street', '12345 Example City'] }), [])
  for (const address of [[], [''], ['1 Example Street', ' '], '1 Example Street', [1]]) {
    assert.ok(legalErrors({ name: 'Ada Example', email: 'ada@example.org', address }).some((e) => e.includes('legal.address')))
  }
})
```

- [ ] **Step 2: Run** `npm test`. Expected: the two new tests fail.
- [ ] **Step 3: Implement in `scripts/lib/registry.ts`:** the `Legal` interface, `legal` on `Registry`, the rules in `validateRegistry` with messages starting `variants.json: "legal" must be…`, `variants.json: legal.name…`, `legal.email…`, `legal.address…`, and the matching narrowing in `isRegistry`. An email is accepted when it has no whitespace, exactly one `@`, a non-empty local part and a domain containing a dot that neither starts nor ends with one.
- [ ] **Step 4: Add `legal: { name: 'Ada Example', email: 'ada@example.org', address: ['1 Example Street', '12345 Example City'] }` to the fixture in `tests/build.test.ts`, and write the failing build test** `the published registry leaves out the legal block`: after `run(root)`, parse `dist/variants.json`, assert it has no `legal` key, that the raw file text does not include `ada@example.org`, and that `default`, `variants`, `contact`, `repository` and `specVersion` are still present. Run `npm test`; expected: this test fails.
- [ ] **Step 4a: In `scripts/build.ts`, write the output registry without `legal`** (destructure it away before `JSON.stringify`; the shell does not read it). The stripping lands in this commit so that no commit ever publishes the email in plain text.
- [ ] **Step 4b: Add `legal` to `variants.json`** (owner's values; stop and ask if they have not been supplied).
- [ ] **Step 5: Update `AGENTS.md`** Registry example and rules, and Build step 5 (the output registry omits `legal`).
- [ ] **Step 6: Run** `npm run typecheck && npm run lint && npm test && npm run build`. Expected: all pass.
- [ ] **Step 7: Commit** `chore: add the legal block to the registry`.

### Task 3: Render the legal page

**Files:**
- Create: `scripts/lib/legal.ts`
- Test: `tests/legal.test.ts`

**Interfaces:**
- Consumes: `Legal`, `Contact` from `scripts/lib/registry.ts`; `parseHtml` from `scripts/lib/html.ts` (tests read the output with it, never with a pattern).
- Produces: `export function legalPage(legal: Legal, contact: Contact, basePath: string): string`, a complete HTML document without the security policy.

- [ ] **Step 1: Write the failing tests** in `tests/legal.test.ts`, each on `parseHtml(legalPage(...))` or on the returned string where noted:
  - `the page has one h1, a main and the shell script for the base path`: one `h1`; one `main`; one `script` with `type="module"` and `src="/personal-website/shell/shell.js"` for base `/personal-website/`; the string starts with `<!doctype html>\n<html lang="en">\n<head>` (the build needs a written head start tag).
  - `without an address there is no legal notice`: no element with `id="legal-notice"`; one with `id="privacy"`.
  - `with an address the legal notice lists the name, every address line and the email`: an `address` element inside `#legal-notice` whose text holds each value.
  - `values are written as text, not markup`: for `name: 'A <b>&"x'` no `b` element exists and the name's text round-trips exactly.
  - `the email is not a link`: no `a` whose `href` starts with `mailto:`.
  - `the email is readable on the page but not literal in the source`: the returned string does not include `ada@example.org` nor `@example`; the parsed text of `#privacy` does include `ada@example.org`.
  - `the page names no variant`: no `meta` with `name="variant"`.
  - `the same input gives the same output`: two calls return equal strings.
- [ ] **Step 2: Run** `npm test`. Expected: fail, module not found.
- [ ] **Step 3: Implement `legalPage`.** A private `escapeHtml(text: string): string` replaces `&`, `<`, `>`, `"` with entities using `replaceAll`. A private `encodeEmail(email: string): string` writes every code point as `&#<decimal>;` and is used wherever the email appears. The head and body styles follow the `404.html` template in `scripts/build.ts` (same colours, `padding-top: var(--shell-height,56px)`, `main` at `max-width: 40rem`), plus `h2`, `address { font-style: normal }` and a visible `a:focus-visible` outline. Title `Legal notice and privacy`, `h1` the same. Copy, in this order:

  **Legal notice** (`<section id="legal-notice">`, only with an address): `<h2>Legal notice</h2>`, the line `Information according to § 5 DDG`, then an `<address>` with the name, one line per address entry and `Email: <email>`.

  **Privacy** (`<section id="privacy">`, `<h2>Privacy</h2>`), one `<h3>` and paragraph each:
  - *Who is responsible*: `<name> is the controller for this website within the meaning of the GDPR. Contact: <email>.`
  - *Hosting*: `This website is hosted on GitHub Pages, a service of GitHub, Inc., San Francisco, USA. When you open a page, GitHub logs and stores your IP address for security purposes, whether or not you are signed in to GitHub. I have no access to these logs. The legal basis is the legitimate interest in a secure and reliable website (Art. 6(1)(f) GDPR). Data may be processed in the USA. Details are in the` link `GitHub Privacy Statement` to `https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement`.
  - *Cookies and local storage*: `This website sets no cookies and uses no analytics, advertising or embedded third-party content. If you use the theme button, your choice (light or dark) is saved in your browser's local storage so that it is remembered on your next visit. It never leaves your device, and you can remove it by clearing the site data in your browser.`
  - *Links to other sites*: `The links to LinkedIn and GitHub are plain links.` (hrefs from `contact`) `No data is sent to these services unless you follow a link; their own privacy terms then apply.`
  - *Your rights*: `You have the right to access, rectification, erasure, restriction of processing, data portability and to object to processing (Art. 15 to 21 GDPR). You may also lodge a complaint with a data protection authority; the authority responsible for this website is the Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.`

  **Sources** (`<section id="sources">`, always): `<h2>Sources</h2>`, the sentence `The wording of this page is my own. It follows these sources:` and a list of five links, each followed by a dash and a note:
  - `§ 5 DDG, general information obligations` (`https://www.gesetze-im-internet.de/ddg/__5.html`): the contents of the legal notice
  - `Art. 13 GDPR (Regulation (EU) 2016/679)` (`https://eur-lex.europa.eu/eli/reg/2016/679/oj`): the information in the privacy section
  - `GitHub Docs, "What is GitHub Pages?", section "Data collection"` (`https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages`): what the host logs
  - `GitHub General Privacy Statement` (`https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement`): how the host processes data
  - `Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen` (`https://www.ldi.nrw.de/`): the supervisory authority
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `chore: render the legal page from the registry`.

### Task 4: Build and publish `legal.html`

**Files:**
- Modify: `scripts/build.ts` (after `404.html`), `scripts/lib/registry.ts` (`RESERVED_NAMES` gains `'legal.html'`)
- Modify: `AGENTS.md` (Architecture tree, reserved names, Build step 6, a sentence that the legal page is build output outside the specification's content inventory, Out of scope unchanged)
- Test: `tests/build.test.ts`, `tests/registry.test.ts`

**Interfaces:**
- Consumes: `legalPage(legal, contact, basePath)` from Task 3; `withPolicy` in `build.ts`.

- [ ] **Step 1: Write the failing tests.**
  - In `the build produces the expected layout`, add `'legal.html'` to the list of paths.
  - In `every published page starts its head with the security policy and the theme script`, add `'legal.html'`.
  - In `reserved ids are rejected`, add `'legal.html'` to the names.
  - New: `the legal page carries the registry's legal data and the shell for the base path`: build the fixture with `basePath: '/personal-website/'`, read `dist/legal.html`, assert it includes `Ada Example` and `src="/personal-website/shell/shell.js"`.
  - New: `a variant holding a top-level legal.html fails the build`: write `variants/beta/legal.html`, expect rejection with a message that includes `legal.html`.
- [ ] **Step 2: Run** `npm test`. Expected: the changed and new tests fail.
- [ ] **Step 3: Implement.** Add the reserved name; in `build.ts` write `join(outDir, 'legal.html')` with `withPolicy(legalPage(registry.legal, registry.contact, base), 'legal.html')`.
- [ ] **Step 4: Update `AGENTS.md`.**
- [ ] **Step 5: Run** `npm run typecheck && npm run lint && npm test && BASE_PATH=/personal-website/ npm run build`. Expected: all pass; `dist/legal.html` exists.
- [ ] **Step 6: Commit** `chore: publish the legal page with every build`.

### Task 5: Link the page from the bar

**Files:**
- Modify: `shell/shell.js` (markup in `mount`)
- Modify: `AGENTS.md` (Shell item 3, Testing table)
- Test: `e2e/shell.spec.ts`, `e2e/content.spec.ts`

- [ ] **Step 1: Write the browser tests.**

  In `e2e/shell.spec.ts`:

```ts
test('the legal link opens the legal page from a variant', async ({ page }) => {
  await page.goto(`${otherEntry.id}/`)
  await control(page, 'shell-legal').click()
  await expect(page).toHaveURL(/\/personal-website\/legal\.html$/)
  await expect(page.locator('h1')).toHaveText('Legal notice and privacy')
  await expect(page.locator('#privacy')).toHaveCount(1)
  await expect(page.locator('#legal-notice')).toHaveCount(registry.legal.address ? 1 : 0)
})

test('the legal link lies inside the viewport', async ({ page }) => {
  await page.goto('./')
  const box = await control(page, 'shell-legal').boundingBox()
  const width = page.viewportSize()?.width
  if (!box || !width) throw new Error('the legal link or the viewport has no size')
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
})
```

  In `the bar works when the registry cannot be loaded`, add `await expect(control(page, 'shell-legal')).toBeVisible()`.

  In `e2e/content.spec.ts`, a `the legal page` block on `legal.html` with the same bodies as the variant tests for: one `h1` and one `main`; LinkedIn and GitHub visible; no horizontal scroll; top bar cleared; no third-party resource and no error; injected script blocked; `a[href^="mailto:"], a[href^="tel:"]` count 0. The existing `contains no personal contact data` test stays on the variants unchanged.
- [ ] **Step 2: Add the link** in `mount()` between the theme button and "View spec": `<a class="link" data-testid="shell-legal" href="${BASE.pathname}legal.html" aria-label="Legal notice and privacy">Legal</a>`. It is static, so it survives a failed registry load.
- [ ] **Step 3: Update `AGENTS.md`.**
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test && BASE_PATH=/personal-website/ npm run build`. Expected: all pass.
- [ ] **Step 5: Commit** `chore: link the legal page from the bar`.
- [ ] **Step 6: Push the branch and open the pull request.** CI runs the browser suite at both widths. If `the legal link lies inside the viewport` fails at 360 px, hide the "View spec" link below 480 px in the bar's stylesheet (`[data-testid="shell-spec"]` inside the existing `@media (max-width: 480px)` rule) and say so in the pull request.

## Not in this plan

- A cookie banner: nothing needs consent.
- The font licence check for the self-hosted typeface in one variant (variant folders are not edited here).
- A data processing agreement with the host: GitHub offers none for free accounts; that is the owner's risk decision, not a code change.
