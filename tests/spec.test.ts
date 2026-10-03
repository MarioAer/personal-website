import test from 'node:test'
import assert from 'node:assert/strict'
import { specVersions } from '../scripts/lib/spec.ts'

test('versions are the dates of the specification files, oldest first', () => {
  assert.deepEqual(specVersions(['2026-10-03.md', '2026-10-01.md']), ['2026-10-01', '2026-10-03'])
})

test('files that are not named by a date are ignored', () => {
  assert.deepEqual(specVersions(['README.md', '2026-10-01.txt', 'draft-2026-10-04.md', '2026-10-01.md']), ['2026-10-01'])
})

test('no specification files yield no versions', () => {
  assert.deepEqual(specVersions([]), [])
})
