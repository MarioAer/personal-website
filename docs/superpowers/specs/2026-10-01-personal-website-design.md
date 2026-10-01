# Personal Website: Specification and Base Architecture

Status: reviewed and approved by two review agents (content and positioning; architecture and testing); awaiting owner approval
Date: 2026-10-01
Owner: Mario Erazo

This document is the single specification for the website. It is the input every generating model receives, and the build publishes it unchanged so visitors can read it from the site ("view spec").

---

## 1. Purpose

A personal website that presents Mario Erazo as an independent consultant for solution architecture, engineering leadership and AI-assisted engineering. The site is not a CV. It states what problems Mario solves, shows evidence, and makes contact easy.

The site has one distinctive mechanic, adopted from keithmancuso.com: the same specification is implemented by several AI models, and the visitor can switch between the implementations with a "Built with" selector in the top bar. The specification itself is readable from the site. The mechanic is a demonstration of the third service (AI-assisted engineering): the same spec, several agents, comparable results.

## 2. Audience and success criteria

| Audience | What they need to find in under a minute |
| --- | --- |
| CTO, VP Engineering, Head of Platform at a mid-size product company | Which problems Mario takes on, evidence that he has solved them, how an engagement starts (`engagement` block) |
| Founder or managing director of a software consultancy | Whether Mario can lead a client team or an integration programme on their behalf |
| Engineer or peer | Technical depth, how Mario thinks, where to follow his work |

Success criteria:

- A visitor can name the three services and one piece of evidence for each without scrolling past the second screen on a laptop.
- A visitor can reach LinkedIn or GitHub from every page in one click.
- The variant selector works without JavaScript errors in current Chrome, Firefox and Safari, on phone and desktop widths.
- Adding a new variant requires exactly: one folder, one registry entry, one commit.
- Lighthouse accessibility score of 95 or higher for every variant.

## 3. Positioning

### 3.1 One-line positioning

Solution architecture, engineering leadership and AI-assisted engineering for cloud-native commerce platforms. Available for consulting engagements.

### 3.2 Services

Three services. Each has a name, a one-sentence promise, a short description of the work, and one or two evidence items. Variants must present all three; order and layout are free.

**Solution architecture and integration**

Promise: Platforms that stay simple while the number of clients, systems and teams grows.

Work: Platform design on AWS and Kubernetes; integration layers across REST, gRPC, Kafka, SQS, S3 and SFTP; domain modelling for commerce and marketplace scenarios with multiple sourcing, delivery and fulfilment options; coordination so that client-specific customisation extends the shared product instead of fragmenting it.

Evidence: Designed the integration layer between a commerce platform and heterogeneous client systems for four airlines and two airports. Halved the monthly AWS bill of the same platform over two years, a six-figure annual saving, through reserved-instance coverage, consolidated databases, self-hosted NAT, internal traffic routing and a migration of logging from ELK to Loki and Grafana.

**Interim and fractional engineering leadership**

Promise: Technical direction and delivery for distributed teams, without a permanent hire.

Work: Lead teams across platform, development and QA; translate client requirements, product initiatives and compliance obligations into prioritised work packages; set technical standards and review processes; manage the relationship between engineering and clients.

Evidence: Led 18 engineers in three teams across five countries. Established a platform review and simplification programme that unified components, delivery processes and technical standards; the programme consolidated 32 services into 24 and reduced the release cadence from four months to six weeks.

**AI-assisted engineering enablement**

Promise: Codebases and pipelines that agents can work in safely, and teams that know how to use them.

Work: Restructure repositories and CI/CD into an agent-ready architecture; define specifications and review gates for AI-assisted development; introduce the practices to the team.

Evidence: Reduced the median lead time from commit to delivery by 40 percent. This website: one specification, several models, comparable results.

### 3.3 Additional evidence (variant's choice)

A variant may include any subset of these items, or none. The evidence items in 3.2 are mandatory; these are not.

- Delivered federated search for a major European airport across flights, destinations, duty-free products and airport information, and product ingestion and indexing for a Nordic department store group.
- Built a recommendation engine (item-to-item and user-to-item collaborative filtering) on Apache Spark; master thesis on learning-to-rank over shop interaction events served through Elasticsearch.
- AWS Certified Solutions Architect – Associate.

### 3.4 How I work

Four short principles, one sentence each. Variants present them as a list or as a short paragraph.

1. Specification before implementation: written, reviewed, then built.
2. Fewer components: consolidation is a feature.
3. Shared product over bespoke forks: client needs extend the platform, they do not fragment it.
4. Measured outcomes: cost, lead time, release cadence.

## 4. Content inventory

Every variant must contain the following sections. Names are canonical identifiers for the content, not required headings; variants choose headings and order within the constraints noted.

| Id | Content | Constraints |
| --- | --- | --- |
| `hero` | Name, one-line positioning (3.1), location "Cologne, Germany", availability line (see section 11) | First screen. Contains none of the job-seeking phrases "looking for", "open to work", "seeking", "hire me", "CV", "résumé". |
| `services` | The three services (3.2) with promise, work and evidence | All three visible; no hidden tabs as the only access. |
| `evidence` | Selected outcomes: all evidence items from 3.2, plus any items from 3.3 the variant chooses, as a compact list | Numbers appear exactly as written in this document or are omitted. |
| `engagement` | How an engagement starts (see section 11) | One short paragraph or a three-step list. |
| `approach` | The four principles (3.4) | |
| `background` | Compact career summary (4.1) | Prose of at most 80 words, or a timeline of at most five lines with organisation and role per line. No responsibilities, no grades, no skills grid. Education and languages optional, one line each. |
| `contact` | LinkedIn, GitHub | Visible from every page (top bar, footer or persistent element). No email address, no phone number. |
| `colophon` | "Built with `<model label>`, generated on `<date>` from this specification"; link that opens the spec | Provided by the shared shell; variants must not duplicate it. |

### 4.1 Career summary

Facts variants may use. The table is a source of facts, not a layout; the `background` row in the inventory limits how it is rendered. Variants must not invent roles, employers, dates or clients.

| Period | Role | Organisation |
| --- | --- | --- |
| 2025 – present | Lead Engineer | Omnevo GmbH, Wiesbaden (remote) |
| 2022 – 2025 | Solution Architect | Omnevo GmbH |
| 2021 – 2022 | Technical Product Owner | Cloudflight GmbH, Cologne |
| 2019 – 2021 | Technical Product Owner, Search and Recommendation | AOE GmbH, Wiesbaden |
| 2017 – 2019 | Software Developer | AOE GmbH |

Education: M.Sc. Business Management (Berlin School of Economics and Law, 2024); M.Sc. Computer Science and Media (Hochschule der Medien, Stuttgart, 2017); B.Sc. Media Informatics (Hochschule der Medien, 2015).

Languages: Spanish (native), German (C2), English (C2).

Technology vocabulary a variant may use inside the `services` Work texts and the `evidence` items, and nowhere else (no separate skills list): Go, Scala, PHP; AWS, Kubernetes, Docker; Elasticsearch, MySQL, Redis, Apache Spark; Kafka, RabbitMQ, SQS; Grafana, Loki, Prometheus; GitLab CI/CD, ArgoCD.

### 4.2 Content rules

- Clients are described, not named: "four airlines and two airports", "a major European airport", "a Nordic department store group". Employers may be named.
- Contact data is limited to LinkedIn and GitHub. No email address, phone number, postal address, date of birth, photograph or nationality. The professional facts in 4.1 are permitted.
- Numbers appear exactly as written in this document. A variant that cannot fit a number omits it.
- Language: English. Formal register, no contractions, no idioms, no emojis.
- Variants may write their own headlines and connective copy, but every factual statement must trace to sections 3 and 4.

## 5. Design constraints for variants

Variants have full freedom of visual design within these limits:

- Responsive from 360 px to 1920 px wide; no horizontal scroll.
- Light and dark theme. The shell sets `data-theme="light"` or `data-theme="dark"` on `<html>`; a variant must style both. When no attribute is set, follow `prefers-color-scheme`.
- Semantic HTML: one `<h1>`, landmarks (`<header>`, `<main>`, `<footer>`), descriptive link text, visible focus states, colour contrast of at least 4.5:1 for body text.
- Fonts: self-hosted in the variant folder or system fonts. No third-party font or script CDNs; the site must work offline once loaded and must not leak visitor data.
- Reserve the top 56 px of the viewport for the shell's top bar (`padding-top: var(--shell-height, 56px)` on `<body>` or equivalent). The bar is fixed-position and lives in a shadow root, so variant CSS cannot and must not restyle it.
- No build step inside a variant: plain HTML, CSS and optional vanilla JavaScript. A variant is a folder a browser can serve directly, and it must work unchanged when served at the site root and under `/<id>/`; this is why the contract (6.4) requires relative paths.
- Total transferred weight of a variant under 1 MB, images included.

## 6. Architecture

### 6.1 Decision

Static site, served by GitHub Pages, built by a small Node script. No site framework, and no front-end library: the site has three interactions (theme, variant navigation, viewing the specification), none of which a library such as htmx or React would shorten, and every dependency is weight each variant carries. Rationale: the picker exists so that different models interpret the same specification freely; the fewer framework rules a variant must obey, the fairer the comparison and the simpler it is to add one. The only shared code is the shell. Alternatives considered: Astro (shared layouts, but variants would have to be Astro components) and Next.js static export (mirrors the reference, but requires React per variant and forbids API routes on Pages). Both were rejected for constraining the variants.

### 6.2 Repository layout

```
personal-website/
  docs/superpowers/specs/2026-10-01-personal-website-design.md   this document
  docs/superpowers/specs/variant-prompt.md                       prompt given to every model
  variants.json                 registry of variants and the default
  variants/
    <variant-id>/
      index.html
      ...                       variant-owned assets, relative paths only
  shell/
    shell.js                    top bar: theme, variant selector, links
  scripts/
    build.mjs                   validate registry and variants, assemble dist/
    lib/registry.mjs            registry validation, pure functions
    lib/contract.mjs            variant contract checks, pure functions
    lib/render-spec.mjs         specification markdown to a page
  tests/                        node --test, build and contract
  e2e/                          Playwright, browser behaviour
  .github/workflows/pages.yml   test, build, deploy
  package.json
  dist/                         build output, ignored by git
```

### 6.3 Variant registry (`variants.json`)

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
    "linkedin": "https://www.linkedin.com/in/marioerazo/",
    "github": "https://github.com/MarioAer"
  }
}
```

Rules, all checked by the build:

- `id` is lowercase, matches `^[a-z0-9][a-z0-9.-]*$`, is unique, and equals the folder name under `variants/`.
- `id` is not one of the reserved names `shell`, `spec`, `index.html`, `404.html`, `variants.json`, `CNAME`, and does not equal the name of any top-level file or folder of the default variant (the default variant's files are copied to the output root, where variant folders also live).
- `default` must be an existing `id`. The default variant is served at the site root; every variant, including the default, is also served at `<base>/<id>/`.
- `modelId` is the exact model identifier used by the tool; `toolVersion` is the tool's reported version; `attempts` is the number of full generation runs before the variant was accepted (section 7).
- `specVersion` is the date in the filename of the specification the variant was generated from. The build writes the current specification date into the output registry as a top-level `specVersion`; the shell shows a notice when a variant's value differs, so visitors know a variant predates a specification change.
- Order in the array is the order in the selector.
- `contact` holds the two links the shell renders. It is the single place where a contact URL is changed.

### 6.4 Variant contract

A folder under `variants/<id>/` is a valid variant when:

1. `index.html` exists and contains `<meta name="variant" content="<id>">` with the folder's id.
2. `index.html` contains exactly one `<script type="module" src="/shell/shell.js"></script>`, in `<head>`. This is the only absolute path a variant may contain; the build rewrites it to the deployment base path (6.6).
3. Every other resource reference is relative (`./style.css`, `fonts/inter.woff2`; `../` is forbidden) or a `data:` or `blob:` URI or a fragment (`#top`). This excludes external URLs in every resource position. The build checks these constructs syntactically: the attributes `src`, `href`, `srcset`, `poster`, `data` and `xlink:href` on every element in `index.html` and in `.svg` files; `url()` and `@import` in `<style>` elements, `style` attributes and every `.css` file in the folder. The single exception is `<a href>`, which may also be an `https://` URL; `mailto:`, `tel:` and every other scheme are forbidden (4.2). The check is syntactic over the listed constructs; it is not a guarantee about computed URLs.
4. Variant JavaScript must not request absolute paths (`fetch('/x')`, `new Image().src = '/x'`), because the default variant is served both at the root and under `/<id>/`. Variant scripts resolve their own assets relative to `document.baseURI`. The build warns when a string literal in a variant `.js` file or inline script starts with `/` and is not `//`; the reviewer in section 7 decides.
5. The folder has no top-level entry named `shell`, `spec`, `404.html`, `variants.json`, `CNAME` or `.nojekyll`.
6. The file satisfies the content inventory in section 4 (checked by review, not by the build).

The build enforces 1 to 3 and 5, warns on 4, and fails with a message naming the variant and the rule.

### 6.5 Shell (`shell/shell.js`)

One file, no framework, no custom element, no runtime dependency. It is a module script that runs after the page is parsed and does four things:

1. Creates a `<div>` as the first child of `<body>`, attaches a shadow root, and writes the top bar into it with one template string and one `<style>` block. The shadow root is three lines of code and is the reason variant CSS cannot reach the bar and the bar's CSS cannot reach the variant.
2. Derives the site base as `new URL('..', import.meta.url)` and fetches `<base>variants.json` with `{ cache: 'no-cache' }`.
3. Renders the bar: site name linking to `<base>`; a theme toggle that writes `data-theme` on `<html>` and stores the value in `localStorage` under `theme` (initial value: stored, else `prefers-color-scheme`); a labelled `<select>` listing the registry entries that navigates to `<base>` for the default id and `<base><id>/` otherwise; a "View spec" link to `<base>spec/`; LinkedIn and GitHub links with accessible labels.
4. Sets `--shell-height: 56px` on `:root`.

There is no drawer, no dialog, no focus trap and no markdown rendering in the browser: the specification is an ordinary page at `<base>spec/`, produced by the build. When `variants.json` fails to load, the selector is hidden and the rest of the bar works.

The colophon line from section 4 (model label, generation date, specification version, and a notice when the variant's `specVersion` differs from the site's) is rendered in the bar when the registry loads, or in the bar's title attribute on narrow viewports.

### 6.6 Build (`scripts/build.mjs`)

Inputs: the repository, the environment variable `BASE_PATH` (default `/`; for a GitHub project site `/personal-website/`), and optionally `SITE_DOMAIN`.

1. Read and validate `variants.json` (6.3). Take the specification date from the specification filename.
2. Validate every registered variant against the contract (6.4); fail on the first violation, print all warnings.
3. Empty `dist/`.
4. Copy `variants/<default>/*` to `dist/`.
5. Copy every `variants/<id>/*` to `dist/<id>/`.
6. In every copied `index.html`, rewrite the `src` of the shell script tag from `/shell/shell.js` to `${BASE_PATH}shell/shell.js`. No other content is rewritten.
7. Copy `shell/` to `dist/shell/` and write `dist/variants.json` with the top-level `specVersion` added.
8. Render the specification markdown to `dist/spec/index.html`: a minimal document with the shell script tag, a `<main>` holding the rendered markdown, and a small stylesheet. Rendering uses `marked`, the one development dependency of the build.
9. Write `dist/.nojekyll`, `dist/404.html` (the shell script tag, a heading, and a sentence pointing to the selector), and `dist/CNAME` when `SITE_DOMAIN` is set.

Output is deterministic: identical inputs produce byte-identical `dist/`.

### 6.7 Deployment

GitHub Actions workflow on push to `main`: `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact` on `dist/`, `actions/deploy-pages`. Pull requests run `npm test` and `npm run build` only. The workflow sets `BASE_PATH=/<repository name>/` unless the repository variable `SITE_DOMAIN` is set, in which case `BASE_PATH=/` and `dist/CNAME` is written.

Switching to the custom domain later requires: setting the `SITE_DOMAIN` repository variable, the DNS records (CNAME or A/AAAA, plus the TXT record GitHub requires for domain verification), and entering the domain once in the repository's Pages settings. Alternatively the repository can be renamed to `marioaer.github.io`, which serves at the root without a custom domain; the build supports both because `BASE_PATH` is an input.

## 7. Generating a variant

1. Create a branch `variant/<id>`.
2. Give the model this specification and the prompt stored in `docs/superpowers/specs/variant-prompt.md`, created in the first milestone. The prompt refers to sections by title, not number ("Positioning", "Content inventory", "Design constraints for variants", "Variant contract"), names the target folder, forbids changes outside it, and records the specification date it was written for. Record `modelId`, `toolVersion` and the date in the registry entry.
3. Generation is single-shot. If the result violates the contract or the content inventory, the model is instructed to fix it in the same session. A full regeneration from scratch is allowed once; `attempts` records the count. If the second run also fails review, the variant is not published for that model; the branch is kept for reference and the model may be retried after the next specification change.
4. Add the registry entry, run `npm test` and `npm run build`, open the result locally with `npm run serve` (which serves `dist/` under the configured base path, so the subpath is exercised).
5. Review against the content inventory (4), the design constraints (5) and the contract warnings (6.4 rule 4). Any fix, whether content, design or contract, is first requested from the model; manual edits are a last resort and are listed in the variant's `NOTES.md`.
6. Open a pull request; merge after review.

## 8. Testing

Two tools, both standard: Node's built-in test runner for everything that is a pure function, and Playwright for everything that needs a browser. No jsdom, no second assertion library. Tests are written before implementation.

| Layer | Tool | Covers |
| --- | --- | --- |
| Build and contract | `node --test` | Registry validation: missing default, duplicate id, invalid id pattern, reserved id, id colliding with a default-variant top-level entry, missing `modelId`. Contract checks: each rule in 6.4 with one passing and one failing fixture, including `data:` URIs accepted and `../` rejected. Build on a fixture repository: output layout, shell path rewritten for `BASE_PATH=/` and `/sub/`, `specVersion` injected, spec page produced, determinism (two builds, identical file hashes). |
| Browser | Playwright, projects chromium, firefox and webkit, viewports 360×780 and 1440×900, against `dist/` built with `BASE_PATH=/personal-website/` and served under that subpath | Shell: theme toggle writes and persists `data-theme`; selector navigates to the right URL for default and non-default ids; "View spec" reaches the specification page; selector hidden when `variants.json` is unavailable. Site: LinkedIn and GitHub links visible on `/`, every `/<id>/`, the spec page and the 404 page; no console errors or failed requests; at 1440×900 the three service names from 3.2 and one evidence sentence for each are positioned within the first two viewport heights (document y below 1800 px). webkit approximates Safari. |

Accessibility and performance are checked manually with the browser's built-in Lighthouse panel against the targets in section 2 before a variant is merged. A Lighthouse CI job may be added later; it is not part of the first milestone.

Manual review covers what tests cannot: the content inventory, tone rules, and the visual quality of a variant.

## 9. Out of scope

- Blog, articles, RSS.
- Contact form, analytics, cookies.
- CV download.
- Server-side code of any kind.
- A content management system; content changes are edits to this document followed by regeneration of variants.

## 10. First milestone

Repository scaffold with registry, shell, build script, workflow and tests, plus one variant generated by Claude Fable 5.1 as the default. Further Claude models follow as separate variants.

## 11. Decisions awaiting owner confirmation

These two statements are proposals by the author of this document, not facts from the CV. The owner confirms or changes them in the spec review; the build does not depend on them.

| Item | Proposed wording | Fallback if not confirmed |
| --- | --- | --- |
| Availability line (`hero`) | "Available for engagements from Q1 2027" | "Available for consulting engagements" without a date |
| LinkedIn URL | `https://www.linkedin.com/in/marioerazo/` | The LinkedIn link is omitted and GitHub is the only contact link |
| How an engagement starts (`engagement`) | "An engagement starts with a written exchange about the problem, followed by a scoped assessment of two to four weeks that ends in a written report with recommendations. A longer engagement is decided on that basis." | The `engagement` block is omitted and the success criterion in section 2 is reduced to "how to make contact" |
