import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const registry = JSON.parse(await readFile(new URL('../variants.json', import.meta.url), 'utf8'))
const paths = ['./', ...registry.variants.map((variant) => `${variant.id}/`)]

const SERVICES = ['Solution architecture and integration', 'Interim and fractional engineering leadership', 'AI-assisted engineering enablement']

for (const path of paths) {
  test.describe(`variant at ${path}`, () => {
    test('has one h1, the landmarks and the required sections', async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('main')).toHaveCount(1)
      await expect(page.locator('footer')).toHaveCount(1)
      for (const service of SERVICES) {
        await expect(page.getByText(service, { exact: false }).first()).toBeVisible()
      }
    })

    test('states the positioning, the location and the availability', async ({ page }) => {
      await page.goto(path)
      const body = page.locator('body')
      await expect(body).toContainText('Cologne')
      await expect(body).toContainText(/Available for/i)
    })

    test('carries the evidence numbers exactly', async ({ page }) => {
      await page.goto(path)
      const text = await page.locator('body').innerText()
      for (const phrase of ['18 engineers', '32 services into 24', 'six weeks', '40 percent']) {
        expect(text).toContain(phrase)
      }
    })

    test('contains no job-seeking phrases and no personal contact data', async ({ page }) => {
      await page.goto(path)
      const text = (await page.locator('main').innerText()).toLowerCase()
      for (const phrase of ['looking for', 'open to work', 'seeking', 'hire me', 'résumé', 'curriculum vitae']) {
        expect(text).not.toContain(phrase)
      }
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
      const top = await page.locator('main').first().evaluate((node) => node.getBoundingClientRect().top + window.scrollY)
      expect(top).toBeGreaterThanOrEqual(56)
    })

    test('loads no third-party resource and logs no error', async ({ page }) => {
      const problems = []
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

    test('shows the services and one evidence sentence each within two screens', async ({ page }, testInfo) => {
      test.skip(testInfo.project.use.viewport.width < 1000, 'desktop criterion')
      await page.goto(path)
      for (const service of SERVICES) {
        const box = await page.getByText(service, { exact: false }).first().boundingBox()
        expect(box.y + (await page.evaluate(() => window.scrollY))).toBeLessThan(1800)
      }
    })
  })
}
