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

/** Where a reference resolves to, before it is judged against the rule for its position. */
type ReferenceKind = 'ok' | 'https' | 'scheme' | 'outside' | 'invalid'

interface ReferenceContext {
  where: string
  /** The variant's folder as a path under VARIANT_ORIGIN, with a trailing slash. */
  folder: string
  isAnchor: boolean
  errors: string[]
}

const SHELL_SRC = '/shell/shell.js'
/**
 * References are resolved against a page in a variant folder on this origin, as a browser resolves
 * them, so that a URL is judged by where it leads and not by how it is spelled. The host can never be
 * a real one.
 */
const VARIANT_ORIGIN = 'https://variant.invalid'
/** Attributes that hold one reference to another resource, by qualified name. */
const URL_ATTRS = ['src', 'href', 'poster', 'data', 'xlink:href', 'action', 'formaction', 'background']
/** Attributes that hold a list of image candidates: a URL, then optional descriptors, separated by commas. */
const SRCSET_ATTRS = ['srcset', 'imagesrcset']
/** Attributes that hold a list of URLs separated by ASCII whitespace. */
const URL_LIST_ATTRS = ['ping']
const ASCII_WHITESPACE = /[\t\n\f\r ]+/u
const EXTERNAL_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'ws:', 'wss:'])

/** Script types that are programs; other types are data blocks, read as JSON when they are import maps or rules. */
const JAVASCRIPT_TYPES: ReadonlySet<string> = new Set(['', 'module', 'text/javascript', 'application/javascript'])
const isJsonType = (type: string): boolean => type === 'importmap' || type === 'speculationrules' || type.endsWith('json')

/** True for a string that names another site: an http(s) or websocket URL, or a protocol-relative one. */
function isExternalUrl(value: string): boolean {
  if (value.startsWith('//')) return true
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

/** Warns about every string that looks like an absolute path or an external URL, and about source that cannot be read. */
function scriptStringWarnings(source: { strings?: string[] | undefined; error?: string | undefined }, where: string): string[] {
  if (source.strings === undefined) return [`${where}: the script could not be parsed (${source.error ?? 'unknown error'}); review it for absolute paths and external URLs`]
  const warnings: string[] = []
  for (const value of source.strings) {
    if (/\s/u.test(value)) continue
    if (isExternalUrl(value)) warnings.push(`${where}: the string "${value}" looks like an external URL; variants must not request other sites`)
    else if (value.startsWith('/')) warnings.push(`${where}: the string "${value}" looks like an absolute path; variant scripts must resolve assets relative to document.baseURI`)
  }
  return warnings
}

function scriptWarnings(element: HtmlElement, where: string): string[] {
  const type = (element.attrs.get('type') ?? '').trim().toLowerCase()
  if (JAVASCRIPT_TYPES.has(type)) return scriptStringWarnings(jsStrings(element.text), where)
  if (isJsonType(type)) return scriptStringWarnings(jsonStrings(element.text), where)
  return []
}

/**
 * Resolves the reference as a browser does, which strips tabs, newlines and surrounding control
 * characters, reads a backslash as a slash and decodes `%2e` path segments, and classifies the result.
 */
function classify(value: string, folder: string): ReferenceKind {
  let url: URL
  try {
    url = new URL(value, `${VARIANT_ORIGIN}${folder}index.html`)
  } catch {
    return 'invalid'
  }
  if (url.protocol === 'data:' || url.protocol === 'blob:') return 'ok'
  if (url.origin !== VARIANT_ORIGIN) return url.protocol === 'https:' ? 'https' : 'scheme'
  return url.pathname.startsWith(folder) ? 'ok' : 'outside'
}

function checkReference(value: string, { where, folder, isAnchor, errors }: ReferenceContext): void {
  const kind = classify(value, folder)
  const shown = JSON.stringify(value)
  if (kind === 'ok') return
  if (kind === 'outside' && value.trim() === SHELL_SRC) return
  if (kind === 'https' && isAnchor) return
  if (kind === 'outside') errors.push(`${where}: ${shown} resolves outside the variant folder; only ${SHELL_SRC} may be absolute`)
  else if (kind === 'scheme') errors.push(`${where}: ${shown} uses a forbidden scheme; only https links in <a href> are allowed`)
  else if (kind === 'invalid') errors.push(`${where}: ${shown} is not a valid URL`)
  else errors.push(`${where}: ${shown} is an external URL; variants must carry their own assets`)
}

/** The URL of every image candidate in a srcset; a URL never contains whitespace, and a comma ends its descriptors. */
const srcsetUrls = (value: string): string[] =>
  value.split(',').map((candidate) => candidate.trim().split(ASCII_WHITESPACE)[0] ?? '').filter(Boolean)

function checkCss(text: string, where: string, folder: string, errors: string[], context: CssContext = 'stylesheet'): void {
  for (const value of cssReferences(text, context)) checkReference(value, { where, folder, isAnchor: false, errors })
}

function checkElement(element: HtmlElement, where: string, folder: string, errors: string[]): void {
  for (const name of URL_ATTRS) {
    const value = element.attrs.get(name)
    if (value !== undefined) checkReference(value, { where, folder, isAnchor: element.tag === 'a', errors })
  }
  for (const name of SRCSET_ATTRS) {
    for (const value of srcsetUrls(element.attrs.get(name) ?? '')) checkReference(value, { where, folder, isAnchor: false, errors })
  }
  for (const name of URL_LIST_ATTRS) {
    for (const value of (element.attrs.get(name) ?? '').split(ASCII_WHITESPACE).filter(Boolean)) {
      checkReference(value, { where, folder, isAnchor: false, errors })
    }
  }
  if (element.tag === 'meta' && element.attrs.get('http-equiv')?.trim().toLowerCase() === 'refresh') {
    errors.push(`${where}: a <meta http-equiv="refresh"> navigates without the visitor's action and is not allowed`)
  }
  const style = element.attrs.get('style')
  if (style !== undefined) checkCss(style, where, folder, errors, 'declarationList')
  if (element.tag === 'style') checkCss(element.text, where, folder, errors)
}

/** Checks a variant folder against the variant contract in AGENTS.md. */
export function checkVariant({ id, files }: VariantToCheck): ContractResult {
  const errors: string[] = []
  const warnings: string[] = []
  const folder = `/site/${id}/`
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
        checkElement(element, where, folder, errors)
        if (element.tag === 'script') warnings.push(...scriptWarnings(element, where))
      }
    }
    if (path.endsWith('.css')) checkCss(text, where, folder, errors)
    if (path.endsWith('.js')) warnings.push(...scriptStringWarnings(jsStrings(text), where))
  }

  return { errors, warnings }
}
