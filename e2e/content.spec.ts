import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { isRegistry } from '../scripts/lib/registry.ts'

const registry: unknown = JSON.parse(await readFile(new URL('../variants.json', import.meta.url), 'utf8'))
if (!isRegistry(registry)) throw new Error('variants.json is not a valid registry')
const paths = ['./', ...registry.variants.map((variant) => `${variant.id}/`)]

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i

const flatten = (value: string): string => value.replace(/\s+/g, ' ').trim()

for (const path of paths) {
  test.describe(`variant at ${path}`, () => {
    test('has one h1 and the landmarks', async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('main')).toHaveCount(1)
      await expect(page.locator('footer')).toHaveCount(1)
    })

    test('contains no personal contact data', async ({ page }) => {
      await page.goto(path)
      const text = flatten(await page.locator('body').innerText())
      expect(text).not.toMatch(EMAIL)
      await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0)
    })

    test('reaches LinkedIn and GitHub in one click', async ({ page }) => {
      await page.goto(path)
      const shell = page.locator('site-shell')
      await expect(shell.locator('[data-testid="shell-linkedin"]')).toBeVisible()
      await expect(shell.locator('[data-testid="shell-github"]')).toBeVisible()
    })

    test('does not scroll horizontally', async ({ page }) => {
      await page.goto(path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })

    test('clears the top bar', async ({ page }) => {
      await page.goto(path)
      const reserved = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingTop))
      expect(reserved).toBeGreaterThanOrEqual(56)
    })

    test('loads no third-party resource and logs no error', async ({ page }) => {
      const problems: string[] = []
      page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()) })
      page.on('pageerror', (error) => problems.push(error.message))
      page.on('requestfailed', (request) => problems.push(`failed request: ${request.url()}`))
      page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.hostname !== 'localhost' && url.protocol !== 'data:') problems.push(`third-party request: ${request.url()}`)
      })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(problems).toEqual([])
    })
  })
}

// The specification requires LinkedIn and GitHub to be visible from every page, including the 404
// page, which is not a variant and so is outside the `paths` loop above.
test.describe('the 404 page', () => {
  test('reaches LinkedIn and GitHub in one click', async ({ page }) => {
    await page.goto('no-such-page')
    const shell = page.locator('site-shell')
    await expect(shell.locator('[data-testid="shell-linkedin"]')).toBeVisible()
    await expect(shell.locator('[data-testid="shell-github"]')).toBeVisible()
  })
})
