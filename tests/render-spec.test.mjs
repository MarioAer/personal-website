import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSpecPage } from '../scripts/lib/render-spec.mjs'

const markdown = '# Title\n\nA paragraph with `code`.\n\n- one\n- two\n'

// Every tag the shared shell page and marked's GFM rendering are expected to emit. Any tag outside
// this list is a sign that unescaped angle-bracket text in the specification markdown (such as an
// un-backticked placeholder like <model label>) was rendered as if it were real HTML.
const EXPECTED_TAGS = new Set([
  'html', 'head', 'meta', 'title', 'script', 'style', 'body', 'main',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'hr', 'br',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'del', 'sup', 'sub', 'img',
])

test('rendering the real specification file emits only expected HTML tags', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const specsDir = join(root, 'docs', 'superpowers', 'specs')
  const specFile = (await readdir(specsDir)).filter((name) => name.endsWith('-personal-website-design.md')).sort().at(-1)
  const markdown = await readFile(join(specsDir, specFile), 'utf8')
  const html = renderSpecPage(markdown, { basePath: '/', title: 'Specification' })
  const unexpected = new Set()
  for (const match of html.matchAll(/<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi)) {
    const tag = match[1].toLowerCase()
    if (!EXPECTED_TAGS.has(tag)) unexpected.add(tag)
  }
  assert.deepEqual([...unexpected], [])
})

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
