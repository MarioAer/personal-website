import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, defaultTreeAdapter } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'
import { legalPage } from '../scripts/lib/legal.ts'
import { parseHtml } from '../scripts/lib/html.ts'
import type { Contact, Legal } from '../scripts/lib/registry.ts'

type Node = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']

const contact: Contact = { linkedin: 'https://www.linkedin.com/in/example', github: 'https://github.com/example' }
const withAddress: Legal = { name: 'Ada Example', email: 'ada@example.org', address: ['1 Example Street', '12345 Example City'] }
const withoutAddress: Legal = { name: 'Ada Example', email: 'ada@example.org' }
const base = '/personal-website/'

function findById(node: Node, id: string): Element | undefined {
  if (defaultTreeAdapter.isElementNode(node) && node.attrs.some((attr) => attr.name === 'id' && attr.value === id)) return node
  if ('childNodes' in node) {
    for (const child of node.childNodes) {
      const found = findById(child, id)
      if (found) return found
    }
  }
  return undefined
}

/** The text of an element and everything below it, as a browser would read it. */
function textOf(node: Node): string {
  if (defaultTreeAdapter.isTextNode(node)) return defaultTreeAdapter.getTextNodeContent(node)
  return 'childNodes' in node ? node.childNodes.map(textOf).join('') : ''
}

function sectionText(html: string, id: string): string | undefined {
  const section = findById(parse(html), id)
  return section ? textOf(section) : undefined
}

const count = (html: string, tag: string): number => parseHtml(html).filter((element) => element.tag === tag).length

test('the page has one h1, a main and the shell script for the base path', () => {
  const html = legalPage(withAddress, contact, base)
  assert.equal(count(html, 'h1'), 1)
  assert.equal(count(html, 'main'), 1)
  const scripts = parseHtml(html).filter((element) => element.tag === 'script')
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0]?.attrs.get('type'), 'module')
  assert.equal(scripts[0]?.attrs.get('src'), '/personal-website/shell/shell.js')
  assert.ok(html.startsWith('<!doctype html>\n<html lang="en">\n<head>'))
})

test('without an address there is no legal notice', () => {
  const html = legalPage(withoutAddress, contact, base)
  const ids = parseHtml(html).map((element) => element.attrs.get('id'))
  assert.ok(!ids.includes('legal-notice'))
  assert.equal(ids.filter((id) => id === 'privacy').length, 1)
})

test('with an address the legal notice lists the name, every address line and the email', () => {
  const html = legalPage(withAddress, contact, base)
  const notice = findById(parse(html), 'legal-notice')
  assert.ok(notice)
  const address = notice.childNodes.find((child): child is Element => defaultTreeAdapter.isElementNode(child) && child.tagName === 'address')
  assert.ok(address)
  const text = textOf(address)
  for (const value of ['Ada Example', '1 Example Street', '12345 Example City', 'ada@example.org']) {
    assert.ok(text.includes(value), `the address does not hold ${value}`)
  }
  const ids = parseHtml(html).map((element) => element.attrs.get('id'))
  assert.ok(ids.indexOf('legal-notice') < ids.indexOf('privacy'))
})

test('values are written as text, not markup', () => {
  const name = 'A <b>&"x'
  const html = legalPage({ ...withAddress, name }, contact, base)
  assert.equal(count(html, 'b'), 0)
  assert.ok(sectionText(html, 'legal-notice')?.includes(name))
  assert.ok(sectionText(html, 'privacy')?.includes(`${name} is the controller`))
})

test('an address line is written as text, not markup', () => {
  const line = '1 <b>&"x'
  const html = legalPage({ ...withAddress, address: [line, '12345 Example City'] }, contact, base)
  assert.equal(count(html, 'b'), 0)
  assert.ok(sectionText(html, 'legal-notice')?.includes(line))
})

test('a contact URL is written as an attribute value, not as markup', () => {
  const linkedin = 'https://example.org/a"b'
  const html = legalPage(withAddress, { ...contact, linkedin }, base)
  const links = parseHtml(html).filter((element) => element.tag === 'a' && element.attrs.get('href') === linkedin)
  assert.equal(links.length, 1)
  assert.deepEqual([...(links[0]?.attrs.keys() ?? [])], ['href'])
})

test('the email is not a link', () => {
  const html = legalPage(withAddress, contact, base)
  const mailto = parseHtml(html).filter((element) => element.tag === 'a' && element.attrs.get('href')?.toLowerCase().startsWith('mailto:'))
  assert.equal(mailto.length, 0)
})

test('the email is readable on the page but not literal in the source', () => {
  const html = legalPage(withAddress, contact, base)
  assert.ok(!html.includes('ada@example.org'))
  assert.ok(!html.includes('@example'))
  assert.ok(!html.includes('ada&#64;'))
  const encoded = Array.from('ada@example.org', (character) => `&#${character.codePointAt(0)};`).join('')
  assert.ok(html.includes(encoded))
  assert.ok(sectionText(html, 'privacy')?.includes('ada@example.org'))
  assert.ok(sectionText(html, 'legal-notice')?.includes('ada@example.org'))
})

test('the page names no variant', () => {
  const html = legalPage(withAddress, contact, base)
  assert.ok(!parseHtml(html).some((element) => element.tag === 'meta' && element.attrs.get('name') === 'variant'))
})

test('the same input gives the same output', () => {
  assert.equal(legalPage(withAddress, contact, base), legalPage(withAddress, contact, base))
})
