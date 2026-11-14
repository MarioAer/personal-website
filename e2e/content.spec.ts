import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { isRegistry } from '../scripts/lib/registry.ts'
import { PLACEHOLDER_LEGAL_EMAIL } from '../scripts/lib/legal.ts'

const registry: unknown = JSON.parse(await readFile(new URL('../variants.json', import.meta.url), 'utf8'))
if (!isRegistry(registry)) throw new Error('variants.json is not a valid registry')
const paths = ['./', ...registry.variants.map((variant) => `${variant.id}/`)]

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i

const flatten = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** Appends an inline script and reports whether it ran; the build's security policy must block it. */
const injectedScriptRuns = (): boolean => {
  const script = document.createElement('script')
  script.textContent = 'document.documentElement.dataset.injected = "ran"'
  document.head.append(script)
  return document.documentElement.dataset.injected === 'ran'
}

const expectContactLinks = async (page: Page, path: string): Promise<void> => {
  await page.goto(path)
  const shell = page.locator('site-shell')
  await expect(shell.locator('[data-testid="shell-linkedin"]')).toBeVisible()
  await expect(shell.locator('[data-testid="shell-github"]')).toBeVisible()
}

const expectNoHorizontalScroll = async (page: Page, path: string): Promise<void> => {
  await page.goto(path)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

const expectTopBarCleared = async (page: Page, path: string): Promise<void> => {
  await page.goto(path)
  const reserved = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingTop))
  expect(reserved).toBeGreaterThanOrEqual(56)
}

const expectNoThirdPartyNoError = async (page: Page, path: string): Promise<void> => {
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
}

const expectInjectedScriptBlocked = async (page: Page, path: string): Promise<void> => {
  await page.goto(path)
  expect(await page.evaluate(injectedScriptRuns)).toBe(false)
}

const expectPolicyMetaAndScriptBlocked = async (page: Page, path: string): Promise<void> => {
  await page.goto(path)
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
  expect(await page.evaluate(injectedScriptRuns)).toBe(false)
}

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
      await expectContactLinks(page, path)
    })

    test('does not scroll horizontally', async ({ page }) => {
      await expectNoHorizontalScroll(page, path)
    })

    test('clears the top bar', async ({ page }) => {
      await expectTopBarCleared(page, path)
    })

    test('loads no third-party resource and logs no error', async ({ page }) => {
      await expectNoThirdPartyNoError(page, path)
    })

    test('enforces a content security policy that blocks injected script', async ({ page }) => {
      await expectPolicyMetaAndScriptBlocked(page, path)
    })
  })
}

// The specification requires LinkedIn and GitHub to be visible from every page, including the 404
// page, which is not a variant and so is outside the `paths` loop above.
test.describe('the 404 page', () => {
  test('enforces a content security policy that blocks injected script', async ({ page }) => {
    await expectInjectedScriptBlocked(page, 'no-such-page')
  })

  test('reaches LinkedIn and GitHub in one click', async ({ page }) => {
    await expectContactLinks(page, 'no-such-page')
  })
})

// The legal page is not a variant and has no footer, and it states the owner's email address as text,
// so it has its own tests instead of joining the `paths` loop above.
test.describe('the legal page', () => {
  test('has one h1 and a main landmark', async ({ page }) => {
    await page.goto('legal.html')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('main')).toHaveCount(1)
  })

  test('reaches LinkedIn and GitHub in one click', async ({ page }) => {
    await expectContactLinks(page, 'legal.html')
  })

  test('does not scroll horizontally', async ({ page }) => {
    await expectNoHorizontalScroll(page, 'legal.html')
  })

  test('clears the top bar', async ({ page }) => {
    await expectTopBarCleared(page, 'legal.html')
  })

  test('loads no third-party resource and logs no error', async ({ page }) => {
    await expectNoThirdPartyNoError(page, 'legal.html')
  })

  test('enforces a content security policy that blocks injected script', async ({ page }) => {
    await expectPolicyMetaAndScriptBlocked(page, 'legal.html')
  })

  // The build reads the address from LEGAL_EMAIL, and CI gives the tests the same environment as the build.
  test('shows the email address as text, never as a link', async ({ page }) => {
    const expected = process.env.LEGAL_EMAIL?.trim() || PLACEHOLDER_LEGAL_EMAIL
    await page.goto('legal.html')
    await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0)
    // innerText skips the hidden decoy fragments between the characters, as a reader and copy-paste do.
    await expect(page.locator('#privacy')).toContainText(expected, { useInnerText: true })
  })

  test('asks search engines not to index it', async ({ page }) => {
    await page.goto('legal.html')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })
})
