/**
 * The registry as the shell reads it. The build writes the top-level specVersion; the repository
 * copy does not carry one. See scripts/lib/registry.ts for the shape the build validates.
 *
 * @typedef {{
 *   id: string, label: string, tool: string, toolVersion: string, modelId: string,
 *   generatedAt: string, specVersion: string, attempts: number
 * }} RegistryVariant
 * @typedef {{
 *   default: string, variants: RegistryVariant[],
 *   contact?: { linkedin?: string, github?: string }, specVersion?: string
 * }} ShellRegistry
 */

const BASE = new URL('..', import.meta.url)
const VARIANT_ID = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="variant"]'))?.content ?? ''
const STORAGE_KEY = 'theme'

// The registry (variants.json) is the single place a contact URL is changed. These are used only
// when the registry cannot be loaded, and must always match registry.contact exactly; see
// tests/fallback-contact.test.ts.
const FALLBACK_CONTACT = {
  linkedin: 'https://www.linkedin.com/in/marioaer',
  github: 'https://github.com/MarioAer',
}

const storage = {
  /** @returns {string | null} */
  read() {
    try { return window.localStorage.getItem(STORAGE_KEY) } catch { return null }
  },
  /** @param {string} value */
  write(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value) } catch { /* storage unavailable */ }
  },
}

/** @returns {'light' | 'dark'} */
function currentTheme() {
  const stored = storage.read()
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** @param {string} theme */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  storage.write(theme)
}

// Single source of truth for the bar's height: both the stylesheet below and the --shell-height
// custom property (used by pages to offset their content) are derived from this constant.
const BAR_HEIGHT_PX = 56

const STYLE = `
:host { all: initial; }
.bar { position: fixed; inset: 0 0 auto 0; z-index: 2147483000; display: flex; align-items: center; gap: 0.75rem;
  height: ${BAR_HEIGHT_PX}px; padding: 0 1rem; box-sizing: border-box; background: var(--bar-bg); color: var(--bar-fg);
  border-bottom: 1px solid var(--bar-rule); font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif; }
:host { --bar-bg: #fbfaf8; --bar-fg: #1b1b1a; --bar-rule: #e2e0da; --bar-muted: #5d5d58; }
:host([data-theme="dark"]) { --bar-bg: #14140f; --bar-fg: #eceadf; --bar-rule: #2d2d26; --bar-muted: #a3a099; }
a, button, select { font: inherit; color: inherit; }
.name { font-weight: 600; text-decoration: none; white-space: nowrap; }
.spacer { flex: 1 1 auto; }
.group { display: flex; align-items: center; gap: 0.4rem; }
.label { color: var(--bar-muted); white-space: nowrap; }
select, button, .link { background: transparent; border: 1px solid var(--bar-rule); border-radius: 6px;
  padding: 0.3rem 0.5rem; cursor: pointer; text-decoration: none; }
button:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.colophon { color: var(--bar-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 22rem; }
.stale { color: #b4441f; }
@media (max-width: 860px) { .label, .colophon { display: none; } }
@media (max-width: 480px) { .name { display: none; } }
svg { display: block; width: 18px; height: 18px; fill: currentColor; }
`.trim()

const ICONS = {
  linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.82-2.05 3.75-2.05 4 0 4.4 2.5 4.4 5.8V21h-4v-5.6c0-1.3-.02-3-1.9-3-1.9 0-2.2 1.4-2.2 2.9V21h-4V9Z"/>',
  github: '<path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
}

/**
 * @param {'linkedin' | 'github'} name
 * @param {string} title
 * @returns {string}
 */
const icon = (name, title) =>
  `<svg viewBox="0 0 24 24" role="img" aria-label="${title}"><title>${title}</title>${ICONS[name]}</svg>`

/** @returns {{ host: HTMLElement, root: ShadowRoot }} */
function mount() {
  const host = document.createElement('site-shell')
  host.dataset.theme = currentTheme()
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>${STYLE}</style>
<nav class="bar" aria-label="Site">
  <a class="name" href="${BASE.pathname}">Mario Erazo</a>
  <span class="colophon" data-testid="shell-colophon"></span>
  <span class="spacer"></span>
  <span class="group registry" hidden>
    <label class="label" for="variant-select">Built with</label>
    <select id="variant-select" data-testid="shell-select"></select>
  </span>
  <button type="button" data-testid="shell-theme" aria-label="Switch colour theme">Theme</button>
  <a class="link" data-testid="shell-spec" href="${BASE.pathname}spec/">View spec</a>
  <span class="group contact"></span>
</nav>`

  document.body.prepend(host)
  document.documentElement.style.setProperty('--shell-height', `${BAR_HEIGHT_PX}px`)
  applyTheme(currentTheme())

  const themeButton = /** @type {HTMLButtonElement} */ (root.querySelector('[data-testid="shell-theme"]'))
  themeButton.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    host.dataset.theme = next
  })

  return { host, root }
}

/**
 * @param {Element} contact
 * @param {'linkedin' | 'github'} key
 * @param {string} title
 * @param {string | undefined} href
 */
function appendContactLink(contact, key, title, href) {
  if (!href) return
  const anchor = document.createElement('a')
  anchor.className = 'link'
  anchor.dataset.testid = `shell-${key}`
  anchor.href = href
  anchor.rel = 'me noopener'
  anchor.setAttribute('aria-label', title)
  anchor.innerHTML = icon(key, title)
  contact.append(anchor)
}

/**
 * @param {ShadowRoot} root
 * @returns {Promise<void>}
 */
async function loadRegistry(root) {
  const response = await fetch(new URL('variants.json', BASE), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`variants.json responded with ${response.status}`)
  const registry = /** @type {ShellRegistry} */ (await response.json())

  const contact = /** @type {Element} */ (root.querySelector('.contact'))
  /** @type {[ 'linkedin' | 'github', string, string | undefined ][]} */
  const links = [
    ['linkedin', 'LinkedIn', registry.contact?.linkedin],
    ['github', 'GitHub', registry.contact?.github],
  ]
  for (const [key, title, href] of links) appendContactLink(contact, key, title, href)

  const entry = registry.variants.find((variant) => variant.id === VARIANT_ID)
  if (entry) {
    const stale = entry.specVersion !== registry.specVersion
    const colophon = /** @type {HTMLElement} */ (root.querySelector('[data-testid="shell-colophon"]'))
    colophon.textContent = `Built with ${entry.label}, ${entry.generatedAt}, spec ${entry.specVersion}${stale ? ' (older specification)' : ''}`
    if (stale) colophon.classList.add('stale')
  }

  const select = /** @type {HTMLSelectElement} */ (root.querySelector('[data-testid="shell-select"]'))
  if (!VARIANT_ID) {
    // The specification page and the 404 page are not a variant, so no option below matches
    // VARIANT_ID. Without this placeholder the browser would select the first variant by default,
    // misreporting it as the current page.
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = 'Select a version'
    placeholder.disabled = true
    placeholder.selected = true
    select.append(placeholder)
  }
  for (const variant of registry.variants) {
    const option = document.createElement('option')
    option.value = variant.id
    option.textContent = variant.label
    option.selected = variant.id === VARIANT_ID
    select.append(option)
  }
  select.addEventListener('change', () => {
    const target = select.value === registry.default ? BASE : new URL(`${select.value}/`, BASE)
    window.location.assign(target)
  })
  const registryGroup = /** @type {HTMLElement} */ (root.querySelector('.registry'))
  registryGroup.hidden = false
}

const { root } = mount()
loadRegistry(root).catch(() => {
  root.querySelector('.registry')?.remove()
  const contact = /** @type {Element} */ (root.querySelector('.contact'))
  if (contact.children.length === 0) {
    appendContactLink(contact, 'linkedin', 'LinkedIn', FALLBACK_CONTACT.linkedin)
    appendContactLink(contact, 'github', 'GitHub', FALLBACK_CONTACT.github)
  }
})
