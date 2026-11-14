import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, defaultTreeAdapter } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'
import { legalPage, PLACEHOLDER_LEGAL_EMAIL } from '../scripts/lib/legal.ts'
import { parseHtml } from '../scripts/lib/html.ts'
import { declaredProperties } from '../scripts/lib/css.ts'
import { visibleText as textOf } from './helpers/visible-text.ts'
import { isEmail } from '../scripts/lib/registry.ts'
import type { Contact, Legal } from '../scripts/lib/registry.ts'

type Node = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']

const contact: Contact = { linkedin: 'https://www.linkedin.com/in/example', github: 'https://github.com/example' }
const withAddress: Legal = { name: 'Ada Example', address: ['1 Example Street', '12345 Example City'] }
const withoutAddress: Legal = { name: 'Ada Example' }
const email = 'ada@example.org'
const base = '/personal-website/'
const page = (legal: Legal = withAddress, address: string = email, links: Contact = contact): string => legalPage(legal, address, links, base)

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

const isHidden = (node: Node): boolean => defaultTreeAdapter.isElementNode(node) && node.attrs.some((attr) => attr.name === 'hidden')

/** The text with the tags stripped and nothing skipped, as a scraper reading the source would see it. */
function strippedText(node: Node): string {
  if (defaultTreeAdapter.isTextNode(node)) return defaultTreeAdapter.getTextNodeContent(node)
  return 'childNodes' in node ? node.childNodes.map(strippedText).join('') : ''
}

function sectionText(html: string, id: string, read: (node: Node) => string = textOf): string | undefined {
  const section = findById(parse(html), id)
  return section ? read(section) : undefined
}

const count = (html: string, tag: string): number => parseHtml(html).filter((element) => element.tag === tag).length

test('the page has one h1, a main and the shell script for the base path', () => {
  const html = page()
  assert.equal(count(html, 'h1'), 1)
  assert.equal(count(html, 'main'), 1)
  const scripts = parseHtml(html).filter((element) => element.tag === 'script')
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0]?.attrs.get('type'), 'module')
  assert.equal(scripts[0]?.attrs.get('src'), '/personal-website/shell/shell.js')
  assert.ok(html.startsWith('<!doctype html>\n<html lang="en">\n<head>'))
})

test('without an address there is no legal notice', () => {
  const html = page(withoutAddress)
  const ids = parseHtml(html).map((element) => element.attrs.get('id'))
  assert.ok(!ids.includes('legal-notice'))
  assert.equal(ids.filter((id) => id === 'privacy').length, 1)
})

test('with an address the legal notice lists the name, every address line and the email', () => {
  const html = page()
  const notice = findById(parse(html), 'legal-notice')
  assert.ok(notice)
  const address = notice.childNodes.find((child): child is Element => defaultTreeAdapter.isElementNode(child) && child.tagName === 'address')
  assert.ok(address)
  const text = textOf(address)
  for (const value of ['Ada Example', '1 Example Street', '12345 Example City', email]) {
    assert.ok(text.includes(value), `the address does not hold ${value}`)
  }
  const ids = parseHtml(html).map((element) => element.attrs.get('id'))
  assert.ok(ids.indexOf('legal-notice') < ids.indexOf('privacy'))
})

test('values are written as text, not markup', () => {
  const name = 'A <b>&"x'
  const html = page({ ...withAddress, name })
  assert.equal(count(html, 'b'), 0)
  assert.ok(sectionText(html, 'legal-notice')?.includes(name))
  assert.ok(sectionText(html, 'privacy')?.includes(`${name} is the controller`))
})

test('an address line is written as text, not markup', () => {
  const line = '1 <b>&"x'
  const html = page({ ...withAddress, address: [line, '12345 Example City'] })
  assert.equal(count(html, 'b'), 0)
  assert.ok(sectionText(html, 'legal-notice')?.includes(line))
})

test('a contact URL is written as an attribute value, not as markup', () => {
  const linkedin = 'https://example.org/a"b'
  const html = page(withAddress, email, { ...contact, linkedin })
  const links = parseHtml(html).filter((element) => element.tag === 'a' && element.attrs.get('href') === linkedin)
  assert.equal(links.length, 1)
  assert.deepEqual([...(links[0]?.attrs.keys() ?? [])], ['href'])
})

test('the email is not a link', () => {
  const html = page()
  const mailto = parseHtml(html).filter((element) => element.tag === 'a' && element.attrs.get('href')?.toLowerCase().startsWith('mailto:'))
  assert.equal(mailto.length, 0)
})

test('the email reads as the address to a reader, a screen reader and copy-paste', () => {
  const html = page()
  assert.ok(sectionText(html, 'privacy')?.includes(email))
  assert.ok(sectionText(html, 'legal-notice')?.includes(email))
})

test('with the tags stripped the markup is not the address', () => {
  const html = page()
  assert.ok(!(sectionText(html, 'privacy', strippedText) ?? '').includes(email))
  assert.ok(!(sectionText(html, 'legal-notice', strippedText) ?? '').includes(email))
  assert.ok(!textOf(parse(html)).includes('q@') && !textOf(parse(html)).includes('@n.'), 'a decoy fragment is visible')
})

test('the raw source holds neither the address nor its domain', () => {
  const html = page()
  assert.ok(!html.includes(email))
  assert.ok(!html.includes('@example'))
  assert.ok(!html.includes('ada&#64;'))
})

test('every decoy is a span with the hidden attribute and no other attribute', () => {
  const html = page()
  const hidden = parseHtml(html).filter((element) => element.attrs.has('hidden'))
  // Four decoys per address (after characters 3, 6, 9 and 12), in each of the two places it appears.
  assert.equal(hidden.length, 2 * 4)
  for (const decoy of hidden) {
    assert.equal(decoy.tag, 'span')
    assert.deepEqual([...decoy.attrs.keys()], ['hidden'])
  }
  assert.equal(parseHtml(html).filter((element) => element.tag === 'span').length, hidden.length, 'a span that is not a decoy')
})

test('the decoys come from the fixed list, in order, cycling', () => {
  const section = findById(parse(page()), 'privacy')
  assert.ok(section)
  const decoys: string[] = []
  const collect = (node: Node): void => {
    if (!('childNodes' in node)) return
    for (const child of node.childNodes) {
      if (isHidden(child)) decoys.push(strippedText(child))
      else collect(child)
    }
  }
  collect(section)
  const list = ['q@', '.z', 'x', '@n.', 'k', '.co']
  assert.deepEqual(decoys, Array.from({ length: 4 }, (_, index) => list[index % list.length]))
})

test('without an address only the privacy section carries the email and its decoys', () => {
  const html = page(withoutAddress)
  assert.equal(parseHtml(html).filter((element) => element.attrs.has('hidden')).length, 4)
  assert.ok(sectionText(html, 'privacy')?.includes(email))
})

test('the page asks search engines not to index it', () => {
  const robots = parseHtml(page()).filter((element) => element.tag === 'meta' && element.attrs.get('name') === 'robots')
  assert.equal(robots.length, 1)
  assert.equal(robots[0]?.attrs.get('content'), 'noindex')
  assert.ok(robots[0]?.inHead)
})

/** The text of the privacy section with each hidden decoy replaced by a bar. */
function marked(html: string): string {
  const section = findById(parse(html), 'privacy')
  assert.ok(section)
  const collect = (node: Node): string => {
    if (isHidden(node)) return '|'
    if (defaultTreeAdapter.isTextNode(node)) return defaultTreeAdapter.getTextNodeContent(node)
    return 'childNodes' in node ? node.childNodes.map(collect).join('') : ''
  }
  return collect(section)
}

test('a decoy follows characters 3, 6, 9 and 12 of the example address', () => {
  assert.ok(marked(page(withoutAddress)).includes('Contact: ada|@ex|amp|le.|org.'))
})

test('no decoy follows the last character, even when the length is a multiple of three', () => {
  assert.ok(marked(page(withoutAddress, 'ab@cd.ef')).includes('Contact: ab@|cd.|ef.'))
  assert.ok(marked(page(withoutAddress, 'a@bc.de')).includes('Contact: a@b|c.d|e.'))
})

test('the page style declares no display property, so nothing can show the hidden decoys', () => {
  const styles = parseHtml(page()).filter((element) => element.tag === 'style')
  assert.equal(styles.length, 1)
  const properties = declaredProperties(styles[0]?.text ?? '')
  assert.ok(properties.length > 0, 'the stylesheet was not read')
  assert.ok(!properties.includes('display'))
})

test('declaredProperties reads rules, nested at-rules and ignores comments and strings', () => {
  const css = '/* display:none */ a{color:red;DISPLAY:block} @media (min-width:1px){b{margin:0}} c::after{content:"display:none"}'
  assert.deepEqual(declaredProperties(css), ['color', 'display', 'margin', 'content'])
})

test('a different email gives that email, and the placeholder is a valid address', () => {
  const html = page(withAddress, 'grace@example.net')
  assert.ok(sectionText(html, 'privacy')?.includes('grace@example.net'))
  assert.ok(!(sectionText(html, 'privacy', strippedText) ?? '').includes('grace@example.net'))
  assert.ok(isEmail(PLACEHOLDER_LEGAL_EMAIL))
})

test('the page names no variant', () => {
  const html = page()
  assert.ok(!parseHtml(html).some((element) => element.tag === 'meta' && element.attrs.get('name') === 'variant'))
})

test('the same input gives the same output', () => {
  assert.equal(page(), page())
})

const sources = [
  'https://www.gesetze-im-internet.de/ddg/__5.html',
  'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
  'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages',
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
  'https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj',
  'https://www.dataprivacyframework.gov/list',
  'https://www.ldi.nrw.de/',
]

test('the page lists its sources', () => {
  for (const legal of [withAddress, withoutAddress]) {
    const html = page(legal)
    assert.equal(parseHtml(html).filter((element) => element.attrs.get('id') === 'sources').length, 1)
    const section = findById(parse(html), 'sources')
    assert.ok(section)
    const links = collectLinks(section)
    assert.deepEqual(links.map((link) => link.attrs.find((attr) => attr.name === 'href')?.value), sources)
  }
})

function collectLinks(node: Node): Element[] {
  if (!('childNodes' in node)) return []
  return node.childNodes.flatMap((child) => [...(defaultTreeAdapter.isElementNode(child) && child.tagName === 'a' ? [child] : []), ...collectLinks(child)])
}

test('every link on the page is an https link', () => {
  const html = page()
  const links = parseHtml(html).filter((element) => element.tag === 'a')
  assert.ok(links.length > 0)
  for (const link of links) {
    assert.ok(link.attrs.get('href')?.startsWith('https://'), `not an https link: ${link.attrs.get('href')}`)
  }
})

test('the hosting paragraph names the transfer to the USA and its basis', () => {
  const privacy = sectionText(page(), 'privacy') ?? ''
  assert.ok(
    privacy.includes(
      'GitHub may process this data in the USA. The European Commission has decided that the USA offers adequate protection for data sent to organisations certified under the EU-U.S. Data Privacy Framework (Implementing Decision (EU) 2023/1795), and GitHub is listed as an active participant. GitHub states that it also relies on the European Commission\'s standard contractual clauses.',
    ),
  )
  assert.ok(!privacy.includes('Data may be processed in the USA.'))
})
