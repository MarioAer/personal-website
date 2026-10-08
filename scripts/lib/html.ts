import { parse, defaultTreeAdapter } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'

/**
 * HTML is read with the WHATWG parser, never with regular expressions. A pattern cannot follow the
 * rules a browser applies to end tags, comments, quoting and raw-text elements; a mismatch between
 * the two is how markup passes a check and still reaches the page.
 */

type ParsedElement = DefaultTreeAdapterMap['element']
type ParsedTemplate = DefaultTreeAdapterMap['template']
type ParsedNode = DefaultTreeAdapterMap['node']

/** Zero-based offsets into the source text; `end` points directly after the last character. */
export interface SourceRange {
  start: number
  end: number
}

export interface HtmlElement {
  /** Lower-case tag name. */
  tag: string
  /** Attributes by qualified lower-case name (`xlink:href`); the first occurrence of a duplicate wins, as in a browser. */
  attrs: ReadonlyMap<string, string>
  /** Source range of each attribute in the start tag, including its name and quotes. */
  attrRanges: ReadonlyMap<string, SourceRange>
  /** The element's direct text content: the body of a `<script>` or `<style>`. */
  text: string
  /** True for an element inside a `<template>`, whose content is inert until a script clones it. */
  inTemplate: boolean
  /** True for an element that has a `<head>` ancestor. */
  inHead: boolean
}

const isTemplate = (element: ParsedElement): element is ParsedTemplate => element.tagName === 'template' && 'content' in element

function describe(element: ParsedElement, inTemplate: boolean, inHead: boolean): HtmlElement {
  const attrs = new Map<string, string>()
  const attrRanges = new Map<string, SourceRange>()
  const locations = element.sourceCodeLocation?.attrs ?? {}
  for (const attr of element.attrs) {
    const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name
    if (attrs.has(name)) continue
    attrs.set(name, attr.value)
    const location = locations[attr.name]
    if (location) attrRanges.set(name, { start: location.startOffset, end: location.endOffset })
  }
  let text = ''
  for (const child of element.childNodes) {
    if (defaultTreeAdapter.isTextNode(child)) text += defaultTreeAdapter.getTextNodeContent(child)
  }
  return { tag: element.tagName.toLowerCase(), attrs, attrRanges, text, inTemplate, inHead }
}

/** Every element of the document in source order, template content included. Comments are not elements. */
export function parseHtml(html: string): HtmlElement[] {
  const found: HtmlElement[] = []
  const visit = (node: ParsedNode, inTemplate: boolean, inHead: boolean): void => {
    if (defaultTreeAdapter.isElementNode(node)) {
      found.push(describe(node, inTemplate, inHead))
      const childInHead = inHead || node.tagName === 'head'
      if (isTemplate(node)) visit(node.content, true, childInHead)
      for (const child of node.childNodes) visit(child, inTemplate, childInHead)
    } else if ('childNodes' in node) {
      for (const child of node.childNodes) visit(child, inTemplate, inHead)
    }
  }
  visit(parse(html, { sourceCodeLocationInfo: true }), false, false)
  return found
}

/**
 * Replaces `from` with `to` in the `src` of every `<script>` whose `src` is `from`, and changes
 * nothing else in the text. Throws when the attribute's source does not contain `from` literally,
 * as when a character reference spells it.
 */
export function rewriteScriptSrc(html: string, from: string, to: string): string {
  const edits: { range: SourceRange; replacement: string }[] = []
  for (const element of parseHtml(html)) {
    const range = element.attrRanges.get('src')
    if (element.tag !== 'script' || range === undefined || element.attrs.get('src')?.trim() !== from) continue
    const raw = html.slice(range.start, range.end)
    const at = raw.indexOf(from)
    if (at === -1) throw new Error(`cannot rewrite the script src "${raw}": it does not contain ${from} literally`)
    edits.push({ range: { start: range.start + at, end: range.start + at + from.length }, replacement: to })
  }
  let result = html
  for (const { range, replacement } of edits.reverse()) result = result.slice(0, range.start) + replacement + result.slice(range.end)
  return result
}
