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
