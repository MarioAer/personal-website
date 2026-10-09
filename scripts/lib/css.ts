import { parse, walk } from 'css-tree'

/**
 * CSS is read with a CSS parser, never with regular expressions. A pattern cannot tell a `url()`
 * from the same characters in a comment or a string, cannot decode escapes, and does not know that
 * a string inside `image-set()` names a resource.
 */

/** A whole stylesheet, or the declarations of a `style` attribute. */
export type CssContext = 'stylesheet' | 'declarationList'

/** Functions whose string arguments name a resource, as `url()` does. */
const RESOURCE_FUNCTIONS: ReadonlySet<string> = new Set(['image-set', '-webkit-image-set', 'image', 'src'])

/** Every resource the CSS refers to, decoded: `url()` values, `@import` targets and resource-function strings. */
export function cssReferences(text: string, context: CssContext = 'stylesheet'): string[] {
  const found: string[] = []
  walk(parse(text, { context }), function (node) {
    if (node.type === 'Url') found.push(node.value)
    else if (node.type === 'String') {
      const insideResourceFunction = this.function !== null && RESOURCE_FUNCTIONS.has(this.function.name.toLowerCase())
      const isImportTarget = this.function === null && this.atrule !== null && this.atrule.name.toLowerCase() === 'import'
      if (insideResourceFunction || isImportTarget) found.push(node.value)
    }
  })
  return found
}
