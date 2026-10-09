import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))
const biome = join(root, 'node_modules', '.bin', 'biome')

interface LintOutcome {
  failed: boolean
  output: string
}

/**
 * Lints one source text with a copy of the repository's Biome configuration and rule, in a scratch
 * folder, so that no fixture file ever sits in the repository.
 */
async function lint(source: string): Promise<LintOutcome> {
  const dir = await mkdtemp(join(tmpdir(), 'pw-lint-'))
  try {
    await mkdir(join(dir, 'scripts'))
    await mkdir(join(dir, 'lint'))
    await copyFile(join(root, 'biome.json'), join(dir, 'biome.json'))
    await copyFile(join(root, 'lint', 'markup-regex.grit'), join(dir, 'lint', 'markup-regex.grit'))
    await writeFile(join(dir, 'scripts', 'sample.ts'), source)
    try {
      const { stdout, stderr } = await run(biome, ['lint', '--vcs-enabled=false', 'scripts/sample.ts'], { cwd: dir })
      return { failed: false, output: stdout + stderr }
    } catch (error) {
      const output = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) + String('stderr' in error ? error.stderr : '') : String(error)
      return { failed: true, output }
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** A rejection counts only when it comes from the markup rule, not from a broken configuration. */
async function assertRejected(source: string): Promise<void> {
  const outcome = await lint(source)
  assert.ok(outcome.failed, outcome.output)
  assert.match(outcome.output, /scripts\/lib\/html\.ts \(parse5\)/, outcome.output)
}

test('a regular expression literal that matches a tag is rejected', () => assertRejected('export const closing = /<\\/script>/i\n'))

test('a regular expression literal that matches a comment marker is rejected', () => assertRejected('export const open = /<!--/\n'))

test('a regular expression built from a string that contains a tag is rejected', () => assertRejected("export const tag = new RegExp('<script\\\\b')\n"))

test('a regular expression literal that matches a css url is rejected', () => assertRejected('export const ref = /url\\(\\s*"([^"]*)"\\s*\\)/gi\n'))

test('a regular expression literal that matches a css import is rejected', () => assertRejected('export const ref = /@import\\s+"([^"]*)"/\n'))

test('a regular expression built from a string that contains a css url is rejected', () => assertRejected("export const ref = new RegExp('url\\\\(')\n"))

test('a regular expression without markup is accepted', async () => {
  const outcome = await lint('export const slashes = /^\\/+/\nexport const word = new RegExp("^[a-z]+$")\n')
  assert.ok(!outcome.failed, outcome.output)
})

test('the rule is switched off for one line only by an explicit, reasoned suppression', async () => {
  const source = '// biome-ignore lint/plugin: the input is a fixed literal, not a document\nexport const open = /<!--/\n'
  assert.ok(!(await lint(source)).failed)
})
