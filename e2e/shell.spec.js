import { test, expect } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'

const registry = JSON.parse(await readFile(new URL('../variants.json', import.meta.url), 'utf8'))
const defaultEntry = registry.variants.find((variant) => variant.id === registry.default)
const otherEntry = registry.variants.find((variant) => variant.id !== registry.default)

// The shell marks a variant stale against the site-level specVersion the build injects, which it takes
// from the specification filename. Comparing variants with one another instead would report green when
// every variant has fallen behind the specification together.
const specsDir = new URL('../docs/superpowers/specs/', import.meta.url)
const specFile = (await readdir(specsDir)).filter((name) => name.endsWith('-personal-website-design.md')).sort().at(-1)
const siteSpecVersion = specFile.slice(0, 10)
const staleEntry = registry.variants.find((variant) => variant.specVersion !== siteSpecVersion)

const shell = (page) => page.locator('site-shell')
const control = (page, id) => shell(page).locator(`[data-testid="${id}"]`)

// Finding 5: the selector is the site's distinctive feature, and a single-entry registry cannot exercise
// it. These helpers serve a two-entry registry from the network so the selected-option logic, both
// navigation directions and the stale notice are covered whatever the real registry holds.
const MOCK_ID = 'mock-variant'
const MOCK_ENTRY = {
  id: MOCK_ID,
  label: 'Mock Variant',
  tool: 'Claude Code',
  toolVersion: '0.0.0',
  modelId: 'mock-variant',
  generatedAt: '2026-09-01',
  specVersion: siteSpecVersion,
  attempts: 1,
}

async function serveTwoEntryRegistry(page, defaultOverrides = {}) {
  // The mock is listed first so that a selector which merely falls back to the first option fails.
  const body = JSON.stringify({
    default: defaultEntry.id,
    variants: [MOCK_ENTRY, { ...defaultEntry, ...defaultOverrides }],
    contact: registry.contact,
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
  await page.goto('./')
  await control(page, 'shell-select').selectOption(otherEntry.id)
  await page.waitForURL(`**/personal-website/${otherEntry.id}/`)
  await expect(page.locator('meta[name="variant"]')).toHaveAttribute('content', otherEntry.id)
})

test('choosing the default variant navigates to the site root', async ({ page }) => {
  test.skip(!otherEntry, 'the registry holds a single variant')
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
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(control(page, 'shell-theme')).toBeVisible()
  await control(page, 'shell-theme').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
  expect(errors).toEqual([])
})

test('the specification link opens the specification page', async ({ page }) => {
  await page.goto('./')
  await control(page, 'shell-spec').click()
  await page.waitForURL('**/personal-website/spec/')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(shell(page).locator('[data-testid="shell-select"]')).toBeVisible()
})

// The specification page is not a variant, so no registered option matches it. Without a
// placeholder, the browser would select the first registered variant and misreport it as current.
test('the specification page selector shows the placeholder, not a variant label', async ({ page }) => {
  await page.goto('spec/')
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
  await page.goto(`${staleEntry.id}/`)
  await expect(control(page, 'shell-colophon')).toContainText(staleEntry.specVersion)
  await expect(control(page, 'shell-colophon')).toContainText('older specification')
})

test('the bar works when the registry cannot be loaded', async ({ page }) => {
  await page.route('**/variants.json', (route) => route.abort())
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(control(page, 'shell-select')).toHaveCount(0)
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
  })
})

test('the 404 page carries the bar', async ({ page }) => {
  const response = await page.goto('no-such-page')
  expect(response.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Page not found')
  await expect(control(page, 'shell-github')).toBeVisible()
})
