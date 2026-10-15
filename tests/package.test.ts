import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRecord } from '../scripts/lib/registry.ts'

// Nothing in the tooling reaches a browser (see AGENTS.md), so every dependency is a development
// dependency. A `dependencies` field means package.json was rewritten by accident, e.g. by `npm init`.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('package.json declares development dependencies only', async () => {
  const manifest: unknown = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (!isRecord(manifest)) assert.fail('package.json must be an object')
  assert.equal(manifest.dependencies, undefined)
  assert.ok(isRecord(manifest.devDependencies), 'package.json must declare devDependencies')
})
