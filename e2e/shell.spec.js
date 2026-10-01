import { test, expect } from '@playwright/test'

const shell = (page) => page.locator('site-shell')
const control = (page, id) => shell(page).locator(`[data-testid="${id}"]`)

test('the bar appears on the default variant', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-select')).toBeVisible()
  await expect(control(page, 'shell-theme')).toBeVisible()
  await expect(control(page, 'shell-spec')).toBeVisible()
})

test('the selector shows the current variant and lists every entry', async ({ page }) => {
  await page.goto('fixture-b/')
  await expect(control(page, 'shell-select')).toHaveValue('fixture-b')
  await expect(control(page, 'shell-select').locator('option')).toHaveCount(2)
})

test('choosing a variant navigates to its path', async ({ page }) => {
  await page.goto('./')
  await control(page, 'shell-select').selectOption('fixture-b')
  await page.waitForURL('**/personal-website/fixture-b/')
  await expect(page.locator('h1')).toHaveText('Fixture B')
})

test('choosing the default variant navigates to the site root', async ({ page }) => {
  await page.goto('fixture-b/')
  await control(page, 'shell-select').selectOption('fixture-a')
  await page.waitForURL((url) => url.pathname === '/personal-website/')
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

test('the colophon names the model and marks a stale variant', async ({ page }) => {
  await page.goto('./')
  await expect(control(page, 'shell-colophon')).toContainText('Fixture A')
  await page.goto('fixture-b/')
  await expect(control(page, 'shell-colophon')).toContainText('2026-09-01')
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

test('the 404 page carries the bar', async ({ page }) => {
  const response = await page.goto('no-such-page')
  expect(response.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Page not found')
  await expect(control(page, 'shell-github')).toBeVisible()
})
