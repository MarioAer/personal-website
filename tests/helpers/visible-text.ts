import { defaultTreeAdapter } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'

/** The text of a node and everything below it, leaving out elements that carry the `hidden` attribute, as a browser, a screen reader and copy-paste do. */
export function visibleText(node: DefaultTreeAdapterMap['node']): string {
  if (defaultTreeAdapter.isTextNode(node)) return defaultTreeAdapter.getTextNodeContent(node)
  if (defaultTreeAdapter.isElementNode(node) && node.attrs.some((attr) => attr.name === 'hidden')) return ''
  return 'childNodes' in node ? node.childNodes.map(visibleText).join('') : ''
}
