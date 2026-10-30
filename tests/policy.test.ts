import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HEAD_MARKUP, THEME_SCRIPT, THEME_STORAGE_KEY, contentSecurityPolicy } from '../scripts/lib/policy.ts'
import { insertAtHeadStart, parseHtml } from '../scripts/lib/html.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Runs the theme script against a stand-in document and storage, and returns the theme it set. */
function runThemeScript(storage: { getItem(key: string): string | null }): string | undefined {
  const dataset: Record<string, string> = {}
  new Function('localStorage', 'document', THEME_SCRIPT)(storage, { documentElement: { dataset } })
  return dataset.theme
}

test('the theme script applies a stored light or dark theme', () => {
  assert.equal(runThemeScript({ getItem: (key) => (key === THEME_STORAGE_KEY ? 'dark' : null) }), 'dark')
  assert.equal(runThemeScript({ getItem: (key) => (key === THEME_STORAGE_KEY ? 'light' : null) }), 'light')
})

test('the theme script leaves the system preference alone when nothing valid is stored', () => {
  assert.equal(runThemeScript({ getItem: () => null }), undefined)
  assert.equal(runThemeScript({ getItem: () => 'purple' }), undefined)
})

test('the theme script does not throw when storage is blocked', () => {
  assert.equal(runThemeScript({ getItem: () => { throw new Error('blocked') } }), undefined)
})

test('the theme script reads the key the shell writes', async () => {
  const source = await readFile(join(root, 'shell', 'shell.js'), 'utf8')
  const match = source.match(/const STORAGE_KEY = '([^']+)'/)
  assert.ok(match, 'shell.js must declare a STORAGE_KEY constant')
  assert.equal(match[1], THEME_STORAGE_KEY)
})

test('the policy allows the theme script by its hash and no other inline script', () => {
  const policy = contentSecurityPolicy()
  const hash = createHash('sha256').update(THEME_SCRIPT).digest('base64')
  const scriptSrc = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src '))
  assert.equal(scriptSrc, `script-src 'self' 'sha256-${hash}'`)
})

test('the policy restricts every fetch to the site and forbids plugins, forms and base changes', () => {
  const directives = new Map(contentSecurityPolicy().split(';').map((part) => {
    const [name = '', ...values] = part.trim().split(/\s+/)
    return [name, values.join(' ')]
  }))
  assert.equal(directives.get('default-src'), "'self'")
  assert.equal(directives.get('connect-src'), "'self'")
  assert.equal(directives.get('object-src'), "'none'")
  assert.equal(directives.get('form-action'), "'none'")
  assert.equal(directives.get('base-uri'), "'self'")
  for (const [name, value] of directives) assert.doesNotMatch(value, /https?:|\*/, `${name} must not allow another site`)
})

test('the head markup is a policy meta tag followed by the theme script', () => {
  const elements = parseHtml(`<!doctype html><html><head>${HEAD_MARKUP}</head><body></body></html>`)
  const meta = elements.find((element) => element.tag === 'meta')
  const script = elements.find((element) => element.tag === 'script')
  assert.equal(meta?.attrs.get('http-equiv'), 'Content-Security-Policy')
  assert.equal(meta?.attrs.get('content'), contentSecurityPolicy())
  assert.equal(script?.text, THEME_SCRIPT)
  assert.ok(HEAD_MARKUP.indexOf('<meta') < HEAD_MARKUP.indexOf('<script'), 'the policy must precede every script')
})

test('insertAtHeadStart places markup directly after the head start tag and changes nothing else', () => {
  const html = '<!doctype html><html lang="en"><HEAD data-x="a>b"><title>t</title></HEAD><body><!-- <head> --></body></html>'
  assert.equal(
    insertAtHeadStart(html, '<meta name="x">'),
    '<!doctype html><html lang="en"><HEAD data-x="a>b"><meta name="x"><title>t</title></HEAD><body><!-- <head> --></body></html>',
  )
})

test('insertAtHeadStart ignores a head tag inside a comment or a script', () => {
  const html = '<!doctype html><!-- <head> --><html><head><script>const s = "<head>"</script></head><body></body></html>'
  assert.equal(insertAtHeadStart(html, 'X'), '<!doctype html><!-- <head> --><html><head>X<script>const s = "<head>"</script></head><body></body></html>')
})

test('insertAtHeadStart refuses a document without a written head start tag', () => {
  assert.throws(() => insertAtHeadStart('<!doctype html><title>t</title><p>x</p>', 'X'), /head start tag/)
})
