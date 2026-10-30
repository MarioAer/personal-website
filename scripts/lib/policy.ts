import { createHash } from 'node:crypto'

/**
 * What the build places at the start of every page's `<head>`. GitHub Pages cannot send response
 * headers, so the Content-Security-Policy is a meta tag; it must precede every element it governs.
 * The theme script applies a stored theme before first paint, because the shell is a module and
 * runs only after the page has been rendered once.
 */

/** The `localStorage` key the shell writes the theme to; tests/policy.test.ts holds the two in agreement. */
export const THEME_STORAGE_KEY = 'theme'

export const THEME_SCRIPT =
  `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

const hashSource = (source: string): string => `'sha256-${createHash('sha256').update(source).digest('base64')}'`

/**
 * Every fetch stays on the site; the theme script is the only inline script, allowed by its hash.
 * Inline styles are allowed because variants use `style` attributes and the shell styles its shadow
 * root with a `<style>` element. `frame-ancestors` is ignored in a meta tag and so is left out.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashSource(THEME_SCRIPT)}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
}

export const HEAD_MARKUP =
  `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}"><script>${THEME_SCRIPT}</script>`
