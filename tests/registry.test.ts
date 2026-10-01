import test from 'node:test'
import assert from 'node:assert/strict'
import type { Variant } from '../scripts/lib/registry.ts'
import { validateRegistry, ID_PATTERN, RESERVED_NAMES, RESERVED_VARIANT_ENTRIES } from '../scripts/lib/registry.ts'

const entry = (over: Partial<Variant> = {}): Record<string, unknown> => ({
  id: 'claude-opus-5',
  label: 'Claude Opus 5',
  tool: 'Claude Code',
  toolVersion: '2.1.0',
  modelId: 'claude-opus-5',
  generatedAt: '2026-10-01',
  specVersion: '2026-10-01',
  attempts: 1,
  ...over,
})

const registry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  default: 'claude-opus-5',
  variants: [entry()],
  contact: { linkedin: 'https://www.linkedin.com/in/marioerazo/', github: 'https://github.com/MarioAer' },
  ...over,
})

const context = (over: { variantFolders?: string[], defaultTopLevelEntries?: string[] } = {}) => ({ variantFolders: ['claude-opus-5'], defaultTopLevelEntries: ['index.html', 'style.css'], ...over })

test('a well-formed registry produces no errors', () => {
  assert.deepEqual(validateRegistry(registry(), context()), [])
})

test('the default must name an existing variant', () => {
  const errors = validateRegistry(registry({ default: 'missing' }), context())
  assert.equal(errors.length, 1)
  assert.match(errors[0], /default/)
  assert.match(errors[0], /missing/)
})

test('duplicate ids are rejected', () => {
  const r = registry({ variants: [entry(), entry()] })
  const errors = validateRegistry(r, context())
  assert.ok(errors.some((e: string) => /duplicate/i.test(e) && e.includes('claude-opus-5')))
})

test('an id that breaks the pattern is rejected', () => {
  const r = registry({ default: 'Claude_5', variants: [entry({ id: 'Claude_5' })] })
  const errors = validateRegistry(r, context({ variantFolders: ['Claude_5'] }))
  assert.ok(errors.some((e: string) => /pattern/i.test(e)))
})

test('reserved ids are rejected', () => {
  for (const name of ['shell', 'spec']) {
    const r = registry({ default: name, variants: [entry({ id: name })] })
    const errors = validateRegistry(r, context({ variantFolders: [name] }))
    assert.ok(errors.some((e: string) => /reserved/i.test(e)), `${name} should be reserved`)
  }
})

test('an id colliding with a top-level entry of the default variant is rejected', () => {
  const r = registry({ variants: [entry(), entry({ id: 'style.css' })] })
  const errors = validateRegistry(r, context({ variantFolders: ['claude-opus-5', 'style.css'] }))
  assert.ok(errors.some((e: string) => /collides/i.test(e) && e.includes('style.css')))
})

test('a missing required field is reported with the field name', () => {
  const broken: Record<string, unknown> = entry()
  delete broken.modelId
  const errors = validateRegistry(registry({ variants: [broken] }), context())
  assert.ok(errors.some((e: string) => e.includes('modelId')))
})

test('a folder without a registry entry is reported', () => {
  const errors = validateRegistry(registry(), context({ variantFolders: ['claude-opus-5', 'orphan'] }))
  assert.ok(errors.some((e: string) => e.includes('orphan')))
})

test('a registry entry without a folder is reported', () => {
  const errors = validateRegistry(registry(), context({ variantFolders: [] }))
  assert.ok(errors.some((e: string) => e.includes('claude-opus-5') && /folder/i.test(e)))
})

test('contact links must be https urls', () => {
  const r = registry({ contact: { linkedin: 'http://example.com', github: 'https://github.com/MarioAer' } })
  assert.ok(validateRegistry(r, context()).some((e: string) => /contact/i.test(e)))
})

test('the exported pattern and reserved lists are usable by other modules', () => {
  assert.ok(ID_PATTERN.test('claude-opus-5'))
  assert.ok(RESERVED_NAMES.includes('variants.json'))
  assert.ok(RESERVED_NAMES.includes('index.html'))
  assert.ok(!RESERVED_VARIANT_ENTRIES.includes('index.html'))
  assert.ok(RESERVED_VARIANT_ENTRIES.includes('shell'))
})
