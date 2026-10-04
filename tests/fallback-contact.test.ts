import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRecord, isRegistry } from '../scripts/lib/registry.ts'

// variants.json is the single place a contact URL is changed (see AGENTS.md). shell/shell.js
// keeps a FALLBACK_CONTACT constant for when the registry cannot be loaded; this test fails if that
// constant drifts from the registry's contact object.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('FALLBACK_CONTACT in shell.js matches the registry contact object exactly', async () => {
  const registry: unknown = JSON.parse(await readFile(join(root, 'variants.json'), 'utf8'))
  if (!isRegistry(registry)) assert.fail('variants.json must be a valid registry')
  const source = await readFile(join(root, 'shell', 'shell.js'), 'utf8')

  const match = source.match(/const FALLBACK_CONTACT = (\{[\s\S]*?\n\})/)
  assert.ok(match, 'shell.js must declare a FALLBACK_CONTACT constant')
  const fallback: unknown = new Function(`return ${match[1]}`)()
  if (!isRecord(fallback)) assert.fail('FALLBACK_CONTACT must be an object literal')

  assert.equal(fallback.linkedin, registry.contact.linkedin)
  assert.equal(fallback.github, registry.contact.github)
})
