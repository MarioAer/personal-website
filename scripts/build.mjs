import { readFile, writeFile, readdir, mkdir, rm, cp } from 'node:fs/promises'
import { join, relative, sep, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRegistry } from './lib/registry.mjs'
import { checkVariant } from './lib/contract.mjs'
import { renderSpecPage } from './lib/render-spec.mjs'

const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.json', '.txt', '.md'])

export function normaliseBasePath(value) {
  const raw = (value ?? '').trim()
  if (raw === '' || raw === '/') return '/'
  return `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}/`
}

async function listFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(path, `${prefix}${entry.name}/`)))
    else files.push({ absolute: path, relative: `${prefix}${entry.name}` })
  }
  return files
}

async function readVariantFiles(dir) {
  const files = new Map()
  for (const file of await listFiles(dir)) {
    const extension = file.relative.slice(file.relative.lastIndexOf('.'))
    files.set(file.relative, TEXT_EXTENSIONS.has(extension) ? await readFile(file.absolute, 'utf8') : null)
  }
  return files
}

async function listVariantFolders(root) {
  try {
    const entries = await readdir(join(root, 'variants'), { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  } catch {
    return []
  }
}

function rewriteShellPath(html, basePath) {
  return html.replace(/(<script\b[^>]*\bsrc\s*=\s*["'])\/shell\/shell\.js(["'])/gi, `$1${basePath}shell/shell.js$2`)
}

export async function build({ root, outDir, basePath, siteDomain, specPath }) {
  const base = normaliseBasePath(basePath)
  const registryPath = join(root, 'variants.json')

  let registry
  try {
    registry = JSON.parse(await readFile(registryPath, 'utf8'))
  } catch (cause) {
    throw new Error(`variants.json could not be read as JSON: ${cause.message}`)
  }

  const variantFolders = await listVariantFolders(root)
  const defaultTopLevelEntries = registry?.default && variantFolders.includes(registry.default)
    ? (await readdir(join(root, 'variants', registry.default))).sort()
    : []

  const registryErrors = validateRegistry(registry, { variantFolders, defaultTopLevelEntries })
  if (registryErrors.length > 0) throw new Error(`The registry is invalid:\n  ${registryErrors.join('\n  ')}`)

  const warnings = []
  for (const variant of registry.variants) {
    const files = await readVariantFiles(join(root, 'variants', variant.id))
    const result = checkVariant({ id: variant.id, files })
    if (result.errors.length > 0) throw new Error(`Variant "${variant.id}" breaks the contract:\n  ${result.errors.join('\n  ')}`)
    warnings.push(...result.warnings)
  }

  if (basename(outDir) !== 'dist') {
    throw new Error(`outDir must end in "dist" before it is recursively removed, got "${outDir}"`)
  }
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  await cp(join(root, 'variants', registry.default), outDir, { recursive: true })
  for (const variant of registry.variants) {
    await cp(join(root, 'variants', variant.id), join(outDir, variant.id), { recursive: true })
  }

  for (const file of await listFiles(outDir)) {
    if (!file.relative.endsWith('.html')) continue
    const html = await readFile(file.absolute, 'utf8')
    const rewritten = rewriteShellPath(html, base)
    if (rewritten !== html) await writeFile(file.absolute, rewritten)
  }

  await cp(join(root, 'shell'), join(outDir, 'shell'), { recursive: true })

  const specVersion = basename(specPath).slice(0, 10)
  await writeFile(join(outDir, 'variants.json'), `${JSON.stringify({ ...registry, specVersion }, null, 2)}\n`)

  await mkdir(join(outDir, 'spec'), { recursive: true })
  const markdown = await readFile(specPath, 'utf8')
  await writeFile(join(outDir, 'spec', 'index.html'), renderSpecPage(markdown, { basePath: base, title: 'Specification' }))

  await writeFile(join(outDir, '.nojekyll'), '')
  await writeFile(join(outDir, '404.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found</title>
<script type="module" src="${base}shell/shell.js"></script>
<style>
:root { color-scheme: light dark; --bg: #fbfaf8; --fg: #1b1b1a; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #14140f; --fg: #eceadf; } }
:root[data-theme="dark"] { --bg: #14140f; --fg: #eceadf; }
body{margin:0;padding-top:var(--shell-height,56px);background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
main{max-width:40rem;margin:0 auto;padding:3rem 1rem}
</style>
</head>
<body>
<main>
<h1>Page not found</h1>
<p>Use the selector in the bar above to open one of the published versions of this site.</p>
</main>
</body>
</html>
`)

  if (siteDomain) await writeFile(join(outDir, 'CNAME'), `${siteDomain}\n`)

  return { warnings }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const specsDir = join(root, 'spec')
  const specFile = (await readdir(specsDir)).filter((name) => name.endsWith('-personal-website-design.md')).sort().at(-1)
  if (!specFile) throw new Error(`No specification found in ${relative(root, specsDir)}${sep}`)
  const { warnings } = await build({
    root,
    outDir: join(root, 'dist'),
    basePath: process.env.BASE_PATH,
    siteDomain: process.env.SITE_DOMAIN,
    specPath: join(specsDir, specFile),
  })
  for (const warning of warnings) console.warn(`warning: ${warning}`)
  console.log(`Built ${relative(root, join(root, 'dist'))} for base path ${normaliseBasePath(process.env.BASE_PATH)}`)
}
