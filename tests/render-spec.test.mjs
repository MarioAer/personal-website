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
