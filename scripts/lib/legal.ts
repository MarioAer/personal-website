import type { Contact, Legal } from './registry.ts'

const PRIVACY_STATEMENT = 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement'

const SOURCES: ReadonlyArray<{ text: string; href: string; note: string }> = [
  { text: '§ 5 DDG, general information obligations', href: 'https://www.gesetze-im-internet.de/ddg/__5.html', note: 'the contents of the legal notice' },
  { text: 'Art. 13 GDPR (Regulation (EU) 2016/679)', href: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj', note: 'the information in the privacy section' },
  {
    text: 'GitHub Docs, "What is GitHub Pages?", section "Data collection"',
    href: 'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages',
    note: 'what the host logs',
  },
  { text: 'GitHub General Privacy Statement', href: PRIVACY_STATEMENT, note: 'how the host processes data' },
  { text: 'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen', href: 'https://www.ldi.nrw.de/', note: 'the supervisory authority' },
]

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

/** Writes every code point as a numeric character reference, so the address reads on the page but not in the source. */
function encodeEmail(email: string): string {
  return Array.from(email, (character) => `&#${character.codePointAt(0)};`).join('')
}

/** The legal notice and privacy page as a complete HTML document, without the security policy. */
export function legalPage(legal: Legal, contact: Contact, basePath: string): string {
  const name = escapeHtml(legal.name)
  const email = encodeEmail(legal.email)
  const notice = legal.address
    ? `<section id="legal-notice">
<h2>Legal notice</h2>
<p>Information according to § 5 DDG</p>
<address>${[name, ...legal.address.map(escapeHtml), `Email: ${email}`].join('<br>\n')}</address>
</section>
`
    : ''
  const sourceItems = SOURCES.map((source) => `<li><a href="${escapeHtml(source.href)}">${escapeHtml(source.text)}</a> \u2014 ${escapeHtml(source.note)}</li>`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Legal notice and privacy</title>
<script type="module" src="${escapeHtml(basePath)}shell/shell.js"></script>
<style>
:root { color-scheme: light dark; --bg: #fbfaf8; --fg: #1b1b1a; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #14140f; --fg: #eceadf; } }
:root[data-theme="dark"] { --bg: #14140f; --fg: #eceadf; }
body{margin:0;padding-top:var(--shell-height,56px);background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
main{max-width:40rem;margin:0 auto;padding:3rem 1rem}
h2{margin-top:2.5rem}
address{font-style:normal}
a{color:inherit}
a:focus-visible{outline:2px solid currentColor;outline-offset:2px}
</style>
</head>
<body>
<main>
<h1>Legal notice and privacy</h1>
${notice}<section id="privacy">
<h2>Privacy</h2>
<h3>Who is responsible</h3>
<p>${name} is the controller for this website within the meaning of the GDPR. Contact: ${email}.</p>
<h3>Hosting</h3>
<p>This website is hosted on GitHub Pages, a service of GitHub, Inc., San Francisco, USA. When you open a page, GitHub logs and stores your IP address for security purposes, whether or not you are signed in to GitHub. I have no access to these logs. The legal basis is the legitimate interest in a secure and reliable website (Art. 6(1)(f) GDPR). Data may be processed in the USA. Details are in the <a href="${PRIVACY_STATEMENT}">GitHub Privacy Statement</a>.</p>
<h3>Cookies and local storage</h3>
<p>This website sets no cookies and uses no analytics, advertising or embedded third-party content. If you use the theme button, your choice (light or dark) is saved in your browser's local storage so that it is remembered on your next visit. It never leaves your device, and you can remove it by clearing the site data in your browser.</p>
<h3>Links to other sites</h3>
<p>The links to <a href="${escapeHtml(contact.linkedin)}">LinkedIn</a> and <a href="${escapeHtml(contact.github)}">GitHub</a> are plain links. No data is sent to these services unless you follow a link; their own privacy terms then apply.</p>
<h3>Your rights</h3>
<p>You have the right to access, rectification, erasure, restriction of processing, data portability and to object to processing (Art. 15 to 21 GDPR). You may also lodge a complaint with a data protection authority; the authority responsible for this website is the Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.</p>
</section>
<section id="sources">
<h2>Sources</h2>
<p>The wording of this page is my own. It follows these sources:</p>
<ul>
${sourceItems}
</ul>
</section>
</main>
</body>
</html>
`
}
