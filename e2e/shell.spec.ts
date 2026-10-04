import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import { isRegistry } from '../scripts/lib/registry.ts'
import { specVersions } from '../scripts/lib/spec.ts'
import type { Registry, Variant } from '../scripts/lib/registry.ts'

const parsed: unknown = JSON.parse(await readFile(new URL('../variants.json', import.meta.url), 'utf8'))
if (!isRegistry(parsed)) throw new Error('variants.json is not a valid registry')
const registry: Registry = parsed
const found = registry.variants.find((variant) => variant.id === registry.default)
if (!found) throw new Error('variants.json names a default that is not registered')
const defaultEntry: Variant = found
const otherEntry = registry.variants.find((variant) => variant.id !== registry.default)

// The shell marks a variant stale against the site-level specVersion the build injects, which it takes
// from the newest file in spec/. Comparing variants with one another instead would report green when
// every variant has fallen behind the specification together.
const specsDir = new URL('../spec/', import.meta.url)
const siteSpecVersion = specVersions(await readdir(specsDir)).at(-1)
if (!siteSpecVersion) throw new Error(`no specification file in ${specsDir.pathname}`)
const staleEntry = registry.variants.find((variant) => variant.specVersion !== siteSpecVersion)

const shell = (page: Page) => page.locator('site-shell')
const control = (page: Page, id: string) => shell(page).locator(`[data-testid="${id}"]`)

// Finding 5: the selector is the site's distinctive feature, and a single-entry registry cannot exercise
// it. These helpers serve a two-entry registry from the network so the selected-option logic, both
// navigation directions and the stale notice are covered whatever the real registry holds.
const MOCK_ID = 'mock-variant'
const MOCK_ENTRY: Variant = {
  id: MOCK_ID,
  label: 'Mock Variant',
  tool: 'Claude Code',
  toolVersion: '0.0.0',
  modelId: 'mock-variant',
  generatedAt: '2026-09-01',
  specVersion: siteSpecVersion,
  attempts: 1,
}

async function serveTwoEntryRegistry(page: Page, defaultOverrides: Partial<Variant> = {}): Promise<void> {
  // The mock is listed first so that a selector which merely falls back to the first option fails.
  const body = JSON.stringify({
    default: defaultEntry.id,
    variants: [MOCK_ENTRY, { ...defaultEntry, ...defaultOverrides }],
    contact: registry.contact,
    repository: registry.repository,
    specVersion: siteSpecVersion,
  })
  await page.route('**/variants.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body }))
}

test('the bar appears on the default variant', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-select')).toBeVisible()
  await expect(control(page, 'shell-theme')).toBeVisible()
  await expect(control(page, 'shell-spec')).toBeVisible()
})

test('the selector shows the current variant and lists every entry', async ({ page }) => {
  await page.goto(`${defaultEntry.id}/`)
  await expect(control(page, 'shell-select')).toHaveValue(defaultEntry.id)
  await expect(control(page, 'shell-select').locator('option')).toHaveCount(registry.variants.length)
})

test('choosing a variant navigates to its path', async ({ page }) => {
  test.skip(!otherEntry, 'the registry holds a single variant')
  if (!otherEntry) return // unreachable: test.skip above has already ended the test
  await page.goto('./')
  await control(page, 'shell-select').selectOption(otherEntry.id)
  await page.waitForURL(`**/personal-website/${otherEntry.id}/`)
  await expect(page.locator('meta[name="variant"]')).toHaveAttribute('content', otherEntry.id)
})

test('choosing the default variant navigates to the site root', async ({ page }) => {
  test.skip(!otherEntry, 'the registry holds a single variant')
  if (!otherEntry) return // unreachable: test.skip above has already ended the test
  await page.goto(`${otherEntry.id}/`)
  await control(page, 'shell-select').selectOption(registry.default)
  await page.waitForURL((url) => url.pathname === '/personal-website/')
})

test('the default variant is also served under its own id', async ({ page }) => {
  await page.goto(`${defaultEntry.id}/`)
  await expect(page.locator('meta[name="variant"]')).toHaveAttribute('content', defaultEntry.id)
  await expect(control(page, 'shell-github')).toBeVisible()
})

test('the theme toggle writes and persists the theme', async ({ page }) => {
  await page.goto('./')
  await control(page, 'shell-theme').click()
  const theme = await page.locator('html').getAttribute('data-theme')
  expect(['light', 'dark']).toContain(theme)
  if (theme === null) throw new Error('the theme toggle left no data-theme attribute')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
})

test('the theme toggle still works when storage throws', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage is blocked') },
    })
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(control(page, 'shell-theme')).toBeVisible()
  await control(page, 'shell-theme').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
  expect(errors).toEqual([])
})

const specUrl = (version: string): string => `${registry.repository}/blob/main/spec/${version}.md`

test('the specification link opens the version the variant was built from', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-spec')).toHaveAttribute('href', specUrl(defaultEntry.specVersion))
})

test('the specification link on a page that is not a variant opens the current version', async ({ page }) => {
  await page.goto('no-such-page')
  await expect(control(page, 'shell-spec')).toHaveAttribute('href', specUrl(siteSpecVersion))
})

// The 404 page is not a variant, so no registered option matches it. Without a placeholder, the
// browser would select the first registered variant and misreport it as current.
test('the 404 page selector shows the placeholder, not a variant label', async ({ page }) => {
  await page.goto('no-such-page')
  const select = control(page, 'shell-select')
  const selected = select.locator('option:checked')
  await expect(selected).toHaveText('Select a version')
  await expect(selected).toBeDisabled()
})

test('the colophon names the model and the generation date', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-colophon')).toContainText(defaultEntry.label)
  await expect(control(page, 'shell-colophon')).toContainText(defaultEntry.generatedAt)
})

test('the colophon marks a variant built from an older specification', async ({ page }) => {
  test.skip(!staleEntry, 'every registered variant matches the current specification')
  if (!staleEntry) return // unreachable: test.skip above has already ended the test
  await page.goto(`${staleEntry.id}/`)
  await expect(control(page, 'shell-colophon')).toContainText(staleEntry.specVersion)
  await expect(control(page, 'shell-colophon')).toContainText('older specification')
})

test('the bar works when the registry cannot be loaded', async ({ page }) => {
  await page.route('**/variants.json', (route) => route.abort())
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(control(page, 'shell-select')).toHaveCount(0)
  await expect(control(page, 'shell-spec')).toHaveCount(0)
  await expect(control(page, 'shell-theme')).toBeVisible()
  await expect(control(page, 'shell-github')).toBeVisible()
  expect(errors).toEqual([])
})

test.describe('with a two-entry registry served from the network', () => {
  test('the selector lists every entry and marks the current variant, not the first', async ({ page }) => {
    await serveTwoEntryRegistry(page)
    await page.goto(`${defaultEntry.id}/`)
    const select = control(page, 'shell-select')
    await expect(select.locator('option')).toHaveCount(2)
    await expect(select.locator('option').first()).toHaveText(MOCK_ENTRY.label)
    await expect(select).toHaveValue(defaultEntry.id)
  })

  test('choosing a non-default variant navigates to its path', async ({ page }) => {
    await serveTwoEntryRegistry(page)
    await page.goto('./')
    await control(page, 'shell-select').selectOption(MOCK_ID)
    await page.waitForURL(`**/personal-website/${MOCK_ID}/`)
  })

  test('choosing the default variant navigates to the site root', async ({ page }) => {
    await serveTwoEntryRegistry(page)
    await page.goto(`${MOCK_ID}/`)
    await control(page, 'shell-select').selectOption(defaultEntry.id)
    await page.waitForURL((url) => url.pathname === '/personal-website/')
  })

  test('the colophon marks a variant built from an older specification', async ({ page }) => {
    await serveTwoEntryRegistry(page, { specVersion: '2026-09-01' })
    await page.goto(`${defaultEntry.id}/`)
    await expect(control(page, 'shell-colophon')).toContainText('2026-09-01')
    await expect(control(page, 'shell-colophon')).toContainText('older specification')
    await expect(control(page, 'shell-spec')).toHaveAttribute('href', specUrl('2026-09-01'))
  })
})

test('the 404 page carries the bar', async ({ page }) => {
  const response = await page.goto('no-such-page')
  if (!response) throw new Error('navigating to no-such-page produced no response')
  expect(response.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Page not found')
  await expect(control(page, 'shell-linkedin')).toBeVisible()
  await expect(control(page, 'shell-github')).toBeVisible()
})
