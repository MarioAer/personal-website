import { marked } from 'marked'

/** The deployment base path the shell script tag is written with, and the document title. */
export interface RenderSpecOptions {
  basePath: string
  title: string
}

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

export function renderSpecPage(markdown: string, { basePath, title }: RenderSpecOptions): string {
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
