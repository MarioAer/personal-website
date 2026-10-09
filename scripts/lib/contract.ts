import { cssReferences } from './css.ts'
import type { CssContext } from './css.ts'
import { parseHtml } from './html.ts'
import type { HtmlElement } from './html.ts'
import { jsStrings, jsonStrings } from './js.ts'
import { RESERVED_VARIANT_ENTRIES } from './registry.ts'

/**
 * Every file in a variant folder, keyed by its path relative to that folder. The value is the file's
 * text, or `null` for a binary file whose contents the contract does not inspect.
 */
export type VariantFiles = Map<string, string | null>

export interface VariantToCheck {
  id: string
  files: VariantFiles
}

/** Errors fail the build; warnings are printed and left to the reviewer. */
export interface ContractResult {
  errors: string[]
  warnings: string[]
}

/** How a reference is classified before it is judged against the rule for its position. */
type ReferenceKind = 'ok' | 'external' | 'https' | 'scheme' | 'absolute' | 'parent'

interface ReferenceContext {
  where: string
  isAnchor: boolean
  errors: string[]
}

const SHELL_SRC = '/shell/shell.js'
/** Attributes that hold a reference to another resource, by qualified name. */
const REFERENCE_ATTRS = ['src', 'href', 'srcset', 'poster', 'data', 'xlink:href']
const ALLOWED_PREFIXES = ['data:', 'blob:', '#']

/** Script types that are programs; other types are data blocks, read as JSON when they are import maps or rules. */
const JAVASCRIPT_TYPES: ReadonlySet<string> = new Set(['', 'module', 'text/javascript', 'application/javascript'])
const isJsonType = (type: string): boolean => type === 'importmap' || type === 'speculationrules' || type.endsWith('json')

/** Warns about every string that looks like an absolute path, and about source that cannot be read. */
function absolutePathWarnings(source: { strings?: string[] | undefined; error?: string | undefined }, where: string): string[] {
  if (source.strings === undefined) return [`${where}: the script could not be parsed (${source.error ?? 'unknown error'}); review it for absolute paths`]
  return source.strings
    .filter((value) => value.startsWith('/') && !value.startsWith('//') && !/\s/u.test(value))
    .map((value) => `${where}: the string "${value}" looks like an absolute path; variant scripts must resolve assets relative to document.baseURI`)
}

function scriptWarnings(element: HtmlElement, where: string): string[] {
  const type = (element.attrs.get('type') ?? '').trim().toLowerCase()
  if (JAVASCRIPT_TYPES.has(type)) return absolutePathWarnings(jsStrings(element.text), where)
  if (isJsonType(type)) return absolutePathWarnings(jsonStrings(element.text), where)
  return []
}

function classify(value: string): ReferenceKind {
  const v = value.trim()
  if (v === '') return 'ok'
  if (ALLOWED_PREFIXES.some((p) => v.startsWith(p))) return 'ok'
  if (v.startsWith('//')) return 'external'
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v.toLowerCase().startsWith('https:') ? 'https' : 'scheme'
  if (v.startsWith('/')) return 'absolute'
  if (v.split('/').includes('..')) return 'parent'
  return 'ok'
}

function checkReference(value: string, { where, isAnchor, errors }: ReferenceContext): void {
  for (const candidate of String(value).split(',').map((part) => part.trim().split(/\s+/)[0] ?? '').filter(Boolean)) {
    const kind = classify(candidate)
    if (kind === 'ok') continue
    if (kind === 'absolute' && candidate === SHELL_SRC) continue
    if (kind === 'https' && isAnchor) continue
    if (kind === 'parent') errors.push(`${where}: "${candidate}" uses a parent-relative path; references must stay inside the variant folder`)
    else if (kind === 'absolute') errors.push(`${where}: "${candidate}" is an absolute path; only ${SHELL_SRC} may be absolute`)
    else if (kind === 'scheme') errors.push(`${where}: "${candidate}" uses a forbidden scheme; only https links in <a href> are allowed`)
    else errors.push(`${where}: "${candidate}" is an external URL; variants must carry their own assets`)
  }
}

function checkCss(text: string, where: string, errors: string[], context: CssContext = 'stylesheet'): void {
  for (const value of cssReferences(text, context)) checkReference(value, { where, isAnchor: false, errors })
}

/** Checks a variant folder against the variant contract in AGENTS.md. */
export function checkVariant({ id, files }: VariantToCheck): ContractResult {
  const errors: string[] = []
  const warnings: string[] = []
  const html = files.get('index.html')

  for (const path of files.keys()) {
    const top = path.split('/')[0] ?? ''
    if (RESERVED_VARIANT_ENTRIES.includes(top.toLowerCase())) {
      errors.push(`variants/${id}/${top}: "${top}" is a reserved name and must not appear in a variant`)
    }
  }

  if (typeof html !== 'string') {
    errors.push(`variants/${id}: index.html is missing`)
    return { errors, warnings }
  }

  const parsed = new Map<string, HtmlElement[]>()
  const elementsOf = (path: string, text: string): HtmlElement[] => {
    const known = parsed.get(path)
    if (known) return known
    const elements = parseHtml(text)
    parsed.set(path, elements)
    return elements
  }

  const indexElements = elementsOf('index.html', html)

  const metaTag = indexElements.find((element) => element.tag === 'meta' && element.attrs.get('name')?.trim().toLowerCase() === 'variant')
  const declared = metaTag?.attrs.get('content')
  if (!declared) errors.push(`variants/${id}/index.html: <meta name="variant" content="${id}"> is missing`)
  else if (declared !== id) errors.push(`variants/${id}/index.html: the variant meta tag declares "${declared}" but the folder is "${id}"`)

  const shellTags = indexElements.filter((element) => element.tag === 'script' && !element.inTemplate && element.attrs.get('src')?.trim() === SHELL_SRC)
  const shellTag = shellTags[0]
  if (shellTags.length !== 1 || shellTag === undefined) {
    errors.push(`variants/${id}/index.html: expected exactly one script tag loading ${SHELL_SRC}, found ${shellTags.length}`)
  } else {
    if (!shellTag.inHead) errors.push(`variants/${id}/index.html: the shell script tag must be inside <head>`)
    if (shellTag.attrs.get('type')?.trim().toLowerCase() !== 'module') {
      errors.push(`variants/${id}/index.html: the shell script tag must have type="module"`)
    }
  }

  for (const [path, text] of files) {
    if (typeof text !== 'string') continue
    const where = `variants/${id}/${path}`
    if (path.endsWith('.html') || path.endsWith('.svg')) {
      for (const element of elementsOf(path, text)) {
        const isAnchor = element.tag === 'a'
        for (const name of REFERENCE_ATTRS) {
          const value = element.attrs.get(name)
          if (value !== undefined) checkReference(value, { where, isAnchor, errors })
        }
        const style = element.attrs.get('style')
        if (style !== undefined) checkCss(style, where, errors, 'declarationList')
        if (element.tag === 'style') checkCss(element.text, where, errors)
        if (element.tag === 'script') warnings.push(...scriptWarnings(element, where))
      }
    }
    if (path.endsWith('.css')) checkCss(text, where, errors)
    if (path.endsWith('.js')) warnings.push(...absolutePathWarnings(jsStrings(text), where))
  }

  return { errors, warnings }
}
