import test from 'node:test'
import assert from 'node:assert/strict'
import type { ContractResult } from '../scripts/lib/contract.ts'
import { checkVariant } from '../scripts/lib/contract.ts'

const SHELL = '<script type="module" src="/shell/shell.js"></script>'

const page = (body = '', head = SHELL, meta = '<meta name="variant" content="demo">'): string =>
  `<!doctype html><html><head>${meta}${head}</head><body>${body}</body></html>`

const run = (files: Record<string, string | null>): ContractResult =>
  checkVariant({ id: 'demo', files: new Map(Object.entries(files)) })

test('a minimal valid variant passes', () => {
  const result = run({ 'index.html': page('<img src="./a.png" alt="a">'), 'a.png': null })
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.warnings, [])
})

test('a missing index.html is an error', () => {
  assert.ok(run({ 'style.css': 'body{}' }).errors.some((e: string) => /index\.html/.test(e)))
})

test('a missing or wrong variant meta tag is an error', () => {
  assert.ok(run({ 'index.html': page('', SHELL, '') }).errors.some((e: string) => /meta name="variant"/.test(e)))
  const wrong = page('', SHELL, '<meta name="variant" content="other">')
  assert.ok(run({ 'index.html': wrong }).errors.some((e: string) => /other/.test(e)))
})

test('the shell script tag is accepted with single quotes and reordered attributes', () => {
  const tag = "<script src='/shell/shell.js' type='module'></script>"
  assert.deepEqual(run({ 'index.html': page('', tag) }).errors, [])
})

test('a missing shell script tag is an error', () => {
  assert.ok(run({ 'index.html': page('', '') }).errors.some((e: string) => /shell\.js/.test(e)))
})

test('two shell script tags are an error', () => {
  assert.ok(run({ 'index.html': page('', SHELL + SHELL) }).errors.some((e: string) => /exactly one/.test(e)))
})

test('a shell script tag outside head is an error', () => {
  const html = `<!doctype html><html><head><meta name="variant" content="demo"></head><body>${SHELL}</body></html>`
  assert.ok(run({ 'index.html': html }).errors.some((e: string) => /head/.test(e)))
})

test('data and blob URIs and fragments are allowed', () => {
  const body = '<img src="data:image/gif;base64,R0lGOD" alt="x"><a href="#main">skip</a>'
  assert.deepEqual(run({ 'index.html': page(body) }).errors, [])
})

test('a parent-relative path is an error', () => {
  assert.ok(run({ 'index.html': page('<img src="../x.png" alt="x">') }).errors.some((e: string) => /\.\./.test(e)))
})

test('an absolute path other than the shell script is an error', () => {
  assert.ok(run({ 'index.html': page('<img src="/x.png" alt="x">') }).errors.some((e: string) => /\/x\.png/.test(e)))
})

test('an external stylesheet or font is an error', () => {
  const head = SHELL + '<link rel="stylesheet" href="https://fonts.example/x.css">'
  assert.ok(run({ 'index.html': page('', head) }).errors.some((e: string) => /fonts\.example/.test(e)))
})

test('an external anchor is allowed but mailto and tel are not', () => {
  assert.deepEqual(run({ 'index.html': page('<a href="https://example.com">x</a>') }).errors, [])
  assert.ok(run({ 'index.html': page('<a href="mailto:a@b.c">x</a>') }).errors.some((e: string) => /mailto/.test(e)))
  assert.ok(run({ 'index.html': page('<a href="tel:+49">x</a>') }).errors.some((e: string) => /tel/.test(e)))
})

test('css url() and @import are checked in stylesheets and inline styles', () => {
  const files = { 'index.html': page(), 'style.css': '@import url("https://x.example/a.css");' }
  assert.ok(run(files).errors.some((e: string) => /style\.css/.test(e)))
  const inline = page('', SHELL + '<style>body{background:url(/bg.png)}</style>')
  assert.ok(run({ 'index.html': inline }).errors.some((e: string) => /bg\.png/.test(e)))
})

test('srcset and xlink:href are checked', () => {
  assert.ok(run({ 'index.html': page('<img srcset="/a.png 1x" src="./a.png" alt="a">') }).errors.some((e: string) => /a\.png/.test(e)))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="/sprite.svg#a"/></svg>'
  assert.ok(run({ 'index.html': page(), 'icon.svg': svg }).errors.some((e: string) => /sprite\.svg/.test(e)))
})

test('an absolute path in variant javascript is a warning, not an error', () => {
  const result = run({ 'index.html': page(), 'app.js': 'fetch("/data.json")' })
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((w: string) => /data\.json/.test(w)))
})

test('an absolute path in a template literal is a warning, not an error', () => {
  const result = run({ 'index.html': page(), 'app.js': 'fetch(`/data.json`)' })
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((w: string) => /data\.json/.test(w)))
})

test('a protocol-relative url in javascript is not warned about', () => {
  assert.deepEqual(run({ 'index.html': page(), 'app.js': 'const u = "//example.com/a"' }).warnings, [])
})

test('a reserved top-level entry is an error', () => {
  assert.ok(run({ 'index.html': page(), 'shell': null }).errors.some((e: string) => /reserved/.test(e)))
  assert.ok(run({ 'index.html': page(), 'favicon.ico': 'x' }).errors.some((e: string) => /reserved/.test(e)))
})

test('a fake tag inside an attribute value does not grant the anchor exception', () => {
  const body = '<img alt="see <a href" src="https://evil.example/x.png">'
  assert.ok(run({ 'index.html': page(body) }).errors.some((e: string) => /evil\.example/.test(e)))
})

test('an absolute path in an inline script is a warning, not an error', () => {
  const html = page('', SHELL + '<script>const src = "/images/logo.png"</script>')
  const result = run({ 'index.html': html })
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((w: string) => /logo\.png/.test(w)))
})

test('a script src that merely contains the shell path does not satisfy the rule', () => {
  const html = page('', '<script type="module" src="/shell/shell.js.bak"></script>')
  assert.ok(run({ 'index.html': html }).errors.some((e: string) => /exactly one/.test(e)))
})

test('references inside html comments are ignored', () => {
  assert.deepEqual(run({ 'index.html': page('<!-- <img src="https://example.com/a.png"> -->') }).errors, [])
})

test('a comment marker inside a script body does not swallow later markup', () => {
  const html = page('<script>const s = "<!--"</script><img src="https://evil.example/x.png" alt="x"><!-- trailing -->')
  assert.ok(run({ 'index.html': html }).errors.some((e: string) => /evil\.example/.test(e)))
})

test('a comment marker inside a script body does not hide the shell tag', () => {
  const head = '<script>const s = "<!--"</script>' + SHELL + '<!-- unrelated -->'
  assert.deepEqual(run({ 'index.html': page('', head) }).errors, [])
})
