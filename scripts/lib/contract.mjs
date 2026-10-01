import { RESERVED_VARIANT_ENTRIES } from './registry.mjs'

const SHELL_SRC = '/shell/shell.js'
const NODE = /<!--[\s\S]*?-->|<([a-z0-9-]+)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g
const SCRIPT_BLOCK = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi
const STYLE_BLOCK_FULL = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi
const ATTR = /\b(src|href|srcset|poster|data|xlink:href)\s*=\s*("([^"]*)"|'([^']*)')/gi
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]+))\s*\)/gi
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/gi
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const STYLE_ATTR = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
const JS_ABSOLUTE = /(?:"|')(\/(?!\/)[^"'\s]*)(?:"|')/g
const ALLOWED_PREFIXES = ['data:', 'blob:', '#']

const attrValue = (match) => match[3] ?? match[4] ?? ''

const srcOf = (attrs) => {
  const match = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  return match ? (match[1] ?? match[2]).trim() : null
}

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

  const blankedHtml = html
    .replace(SCRIPT_BLOCK, (_full, open, _body, close) => `${open}${close}`)
    .replace(STYLE_BLOCK_FULL, (_full, open, _body, close) => `${open}${close}`)

  const scriptTags = [...blankedHtml.matchAll(NODE)].filter((m) => m[1] && m[1].toLowerCase() === 'script')
  const shellTags = scriptTags.filter((m) => srcOf(m[2]) === SHELL_SRC)
  if (shellTags.length !== 1) {
    errors.push(`variants/${id}/index.html: expected exactly one script tag loading ${SHELL_SRC}, found ${shellTags.length}`)
  } else {
    const headEnd = blankedHtml.toLowerCase().indexOf('</head>')
    if (headEnd === -1 || shellTags[0].index > headEnd) {
      errors.push(`variants/${id}/index.html: the shell script tag must be inside <head>`)
    }
    if (!/type\s*=\s*(?:"module"|'module')/i.test(shellTags[0][2])) {
      errors.push(`variants/${id}/index.html: the shell script tag must have type="module"`)
    }
  }

  for (const [path, text] of files) {
    if (typeof text !== 'string') continue
    const where = `variants/${id}/${path}`
    if (path.endsWith('.html') || path.endsWith('.svg')) {
      const blanked = text
        .replace(SCRIPT_BLOCK, (_full, open, _body, close) => `${open}${close}`)
        .replace(STYLE_BLOCK_FULL, (_full, open, _body, close) => `${open}${close}`)

      for (const block of text.matchAll(SCRIPT_BLOCK)) {
        for (const match of block[2].matchAll(JS_ABSOLUTE)) {
          warnings.push(`${where}: the string "${match[1]}" looks like an absolute path; variant scripts must resolve assets relative to document.baseURI`)
        }
      }

      for (const node of blanked.matchAll(NODE)) {
        if (!node[1]) continue
        const attrs = node[2]
        const isAnchor = node[1].toLowerCase() === 'a'
        for (const match of attrs.matchAll(ATTR)) {
          checkReference(attrValue(match), { where, isAnchor, errors })
        }
        for (const attr of attrs.matchAll(STYLE_ATTR)) checkCss(attr[1] ?? attr[2] ?? '', where, errors)
      }
      for (const block of text.matchAll(STYLE_BLOCK)) checkCss(block[1], where, errors)
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
