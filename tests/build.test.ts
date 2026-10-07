import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, normaliseBasePath } from '../scripts/build.ts'
import type { BuildOptions, BuildResult } from '../scripts/build.ts'
import { isRegistry } from '../scripts/lib/registry.ts'

/** Pieces of the fixture repository a single test wants to differ from the valid default. */
interface FixtureOverrides {
  registry?: Record<string, unknown>
  registryText?: string
}

const SHELL = '<script type="module" src="/shell/shell.js"></script>'

const variantHtml = (id: string): string =>
  `<!doctype html><html lang="en"><head><meta name="variant" content="${id}">${SHELL}</head><body><h1>${id}</h1></body></html>`

async function fixture(overrides: FixtureOverrides = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pw-build-'))
  const registry = {
    default: 'alpha',
    variants: [
      { id: 'alpha', label: 'Alpha', tool: 'Claude Code', toolVersion: '1.0.0', modelId: 'alpha-1', generatedAt: '2026-10-01', specVersion: '2026-10-01', attempts: 1 },
      { id: 'beta', label: 'Beta', tool: 'Claude Code', toolVersion: '1.0.0', modelId: 'beta-1', generatedAt: '2026-09-01', specVersion: '2026-09-01', attempts: 1 },
    ],
    contact: { linkedin: 'https://www.linkedin.com/in/marioerazo/', github: 'https://github.com/MarioAer' },
    repository: 'https://github.com/MarioAer/personal-website',
    ...overrides.registry,
  }
  for (const id of ['alpha', 'beta']) {
    await mkdir(join(root, 'variants', id), { recursive: true })
    await writeFile(join(root, 'variants', id, 'index.html'), variantHtml(id))
  }
  await mkdir(join(root, 'shell'), { recursive: true })
  await writeFile(join(root, 'shell', 'shell.js'), '// shell\n')
  await mkdir(join(root, 'spec'), { recursive: true })
  for (const version of ['2026-09-01', '2026-10-01']) await writeFile(join(root, 'spec', `${version}.md`), '# Spec\n\nText.\n')
  await writeFile(join(root, 'variants.json'), overrides.registryText ?? JSON.stringify(registry, null, 2))
  return root
}

const run = (root: string, options: Partial<BuildOptions> = {}): Promise<BuildResult> =>
  build({
    root,
    outDir: join(root, 'dist'),
    basePath: '/',
    ...options,
  })

async function hashTree(dir: string, prefix = ''): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  const parts: string[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) parts.push(await hashTree(path, `${prefix}${entry.name}/`))
    else parts.push(`${prefix}${entry.name}:${createHash('sha256').update(await readFile(path)).digest('hex')}`)
  }
  return parts.join('\n')
}

test('normaliseBasePath adds the missing slashes', () => {
  assert.equal(normaliseBasePath(undefined), '/')
  assert.equal(normaliseBasePath(''), '/')
  assert.equal(normaliseBasePath('/personal-website'), '/personal-website/')
  assert.equal(normaliseBasePath('personal-website'), '/personal-website/')
  assert.equal(normaliseBasePath('/personal-website/'), '/personal-website/')
})

test('the build produces the expected layout', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  const dist = join(root, 'dist')
  for (const path of ['index.html', 'alpha/index.html', 'beta/index.html', 'shell/shell.js', 'variants.json', '404.html', '.nojekyll']) {
    await assert.doesNotReject(readFile(join(dist, path)), `${path} should exist`)
  }
  await assert.rejects(readdir(join(dist, 'spec')), 'the specification is linked on GitHub, not published')
  const rootPage = await readFile(join(dist, 'index.html'), 'utf8')
  assert.match(rootPage, /content="alpha"/)
})

test('the shell path is rewritten for both base paths', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root, { basePath: '/' })
  assert.match(await readFile(join(root, 'dist', 'alpha', 'index.html'), 'utf8'), /src="\/shell\/shell\.js"/)
  await run(root, { basePath: '/personal-website' })
  const page = await readFile(join(root, 'dist', 'alpha', 'index.html'), 'utf8')
  assert.match(page, /src="\/personal-website\/shell\/shell\.js"/)
  assert.doesNotMatch(page, /personal-websiteshell/)
  assert.match(await readFile(join(root, 'dist', '404.html'), 'utf8'), /src="\/personal-website\/shell\/shell\.js"/)
})

test('a variant built from a specification version that has no file fails the build', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await rm(join(root, 'spec', '2026-09-01.md'))
  await assert.rejects(run(root), /2026-09-01/)
})

test('a repository without specification files fails the build', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await rm(join(root, 'spec'), { recursive: true })
  await assert.rejects(run(root), /spec/)
})

test('the output registry carries the current specification version', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  const out: unknown = JSON.parse(await readFile(join(root, 'dist', 'variants.json'), 'utf8'))
  if (!isRegistry(out)) assert.fail('the build must write a valid registry')
  assert.equal(out.specVersion, '2026-10-01')
  assert.equal(out.variants.length, 2)
})

test('the build is deterministic', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  const first = await hashTree(join(root, 'dist'))
  await run(root)
  assert.equal(await hashTree(join(root, 'dist')), first)
})

test('a stale output file is removed by the next build', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await run(root)
  await writeFile(join(root, 'dist', 'stale.txt'), 'x')
  await run(root)
  await assert.rejects(readFile(join(root, 'dist', 'stale.txt')))
})

test('a registry error fails the build with a readable message', async (t) => {
  const root = await fixture({ registry: { default: 'missing' } })
  t.after(() => rm(root, { recursive: true, force: true }))
  await assert.rejects(run(root), /default/)
})

test('malformed registry JSON fails with the file name and no stack trace noise', async (t) => {
  const root = await fixture({ registryText: '{ "default": ' })
  t.after(() => rm(root, { recursive: true, force: true }))
  await assert.rejects(run(root), /variants\.json/)
})

test('a contract violation fails the build naming the variant', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'variants', 'beta', 'index.html'), variantHtml('beta').replace('<body>', '<body><img src="/x.png" alt="x">'))
  await assert.rejects(run(root), /beta/)
})

test('a contract warning is returned, not thrown', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'variants', 'beta', 'app.js'), 'fetch("/data.json")')
  const result = await run(root)
  assert.ok(result.warnings.some((w: string) => /data\.json/.test(w)))
})
