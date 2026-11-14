import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test("variants.json holds the owner's legal data, not placeholders", async () => {
  const text = await readFile(new URL('../variants.json', import.meta.url), 'utf8')
  const message = "variants.json still holds placeholders: put the owner's name and address into the `legal` block"
  assert.ok(!text.includes('REPLACE BEFORE MERGE'), message)
})
