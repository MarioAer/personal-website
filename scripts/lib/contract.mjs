import { RESERVED_VARIANT_ENTRIES } from './registry.mjs'

const SHELL_SRC = '/shell/shell.js'
const SCRIPT_TAG = /<script\b[^>]*>/gi
const ATTR = /\b(src|href|srcset|poster|data|xlink:href)\s*=\s*("([^"]*)"|'([^']*)')/gi
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]+))\s*\)/gi
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/gi
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const STYLE_ATTR = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
const JS_ABSOLUTE = /(?:"|')(\/(?!\/)[^"'\s]*)(?:"|')/g
const ALLOWED_PREFIXES = ['data:', 'blob:', '#']

const attrValue = (match) => match[3] ?? match[4] ?? ''

function classify(value) {
  const v = value.trim()
  if (v === '') return 'ok'
  if (ALLOWED_PREFIXES.some((p) => v.startsWith(p))) return 'ok'
  if (v.startsWith('//')) return 'external'
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v.toLowerCase().startsWith('https:') ? 'https' : 'scheme'
  if (v.startsWith('/')) return 'absolute'
  if (v.split('/').includes('..')) return 'parent'
  return 'ok'
}

function checkReference(value, { where, isAnchor, errors }) {
  for (const candidate of String(value).split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean)) {
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

function checkCss(text, where, errors) {
  for (const pattern of [CSS_URL, CSS_IMPORT]) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[3] ?? ''
      checkReference(value, { where, isAnchor: false, errors })
    }
  }
}

export function checkVariant({ id, files }) {
  const errors = []
  const warnings = []
  const html = files.get('index.html')

  for (const path of files.keys()) {
    const top = path.split('/')[0]
    if (RESERVED_VARIANT_ENTRIES.includes(top.toLowerCase())) {
      errors.push(`variants/${id}/${top}: "${top}" is a reserved name and must not appear in a variant`)
    }
  }

  if (typeof html !== 'string') {
    errors.push(`variants/${id}: index.html is missing`)
    return { errors, warnings }
  }

  const metaMatch = html.match(/<meta\b[^>]*name\s*=\s*["']variant["'][^>]*>/i)
  const metaContent = metaMatch?.[0].match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  const declared = metaContent?.[1] ?? metaContent?.[2]
  if (!declared) errors.push(`variants/${id}/index.html: <meta name="variant" content="${id}"> is missing`)
  else if (declared !== id) errors.push(`variants/${id}/index.html: the variant meta tag declares "${declared}" but the folder is "${id}"`)

  const shellTags = [...html.matchAll(SCRIPT_TAG)].filter((m) => m[0].includes(SHELL_SRC))
  if (shellTags.length !== 1) {
    errors.push(`variants/${id}/index.html: expected exactly one script tag loading ${SHELL_SRC}, found ${shellTags.length}`)
  } else {
    const headEnd = html.toLowerCase().indexOf('</head>')
    if (headEnd === -1 || shellTags[0].index > headEnd) {
      errors.push(`variants/${id}/index.html: the shell script tag must be inside <head>`)
    }
    if (!/type\s*=\s*(?:"module"|'module')/i.test(shellTags[0][0])) {
      errors.push(`variants/${id}/index.html: the shell script tag must have type="module"`)
    }
  }

  for (const [path, text] of files) {
    if (typeof text !== 'string') continue
    const where = `variants/${id}/${path}`
    if (path.endsWith('.html') || path.endsWith('.svg')) {
      for (const match of text.matchAll(ATTR)) {
        const tag = text.slice(Math.max(0, match.index - 200), match.index).match(/<([a-z0-9-]+)(?![\s\S]*<[a-z0-9-]+)/i)
        checkReference(attrValue(match), { where, isAnchor: (tag?.[1] ?? '').toLowerCase() === 'a', errors })
      }
      for (const block of text.matchAll(STYLE_BLOCK)) checkCss(block[1], where, errors)
      for (const attr of text.matchAll(STYLE_ATTR)) checkCss(attr[1] ?? attr[2] ?? '', where, errors)
    }
    if (path.endsWith('.css')) checkCss(text, where, errors)
    if (path.endsWith('.js')) {
      for (const match of text.matchAll(JS_ABSOLUTE)) {
        warnings.push(`${where}: the string "${match[1]}" looks like an absolute path; variant scripts must resolve assets relative to document.baseURI`)
      }
    }
  }

  return { errors, warnings }
}
