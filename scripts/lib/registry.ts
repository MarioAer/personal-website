/** A registry entry, one implementation of the specification. */
export interface Variant {
  id: string
  label: string
  tool: string
  toolVersion: string
  modelId: string
  generatedAt: string
  specVersion: string
  attempts: number
}

/** The two links the shell renders. The registry is the single place a contact URL is changed. */
export interface Contact {
  linkedin: string
  github: string
}

/**
 * `variants.json`. `repository` is the GitHub repository the shell links each variant's
 * specification in. `specVersion` is absent in the repository and written by the build into the
 * copy it places in the output: the newest file in `spec/`.
 */
export interface Registry {
  default: string
  variants: Variant[]
  contact: Contact
  repository: string
  specVersion?: string
}

/** Facts about the repository that the registry is validated against. */
export interface RegistryContext {
  variantFolders?: readonly string[]
  defaultTopLevelEntries?: readonly string[]
  /** The specification versions in `spec/`; every variant's `specVersion` must be one of them. */
  specVersions?: readonly string[]
}

export const ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/
export const RESERVED_NAMES = ['shell', 'index.html', '404.html', 'variants.json', 'cname', '.nojekyll', 'favicon.ico']

// Entries a variant folder may not contain. index.html is absent: every variant must have one.
export const RESERVED_VARIANT_ENTRIES = RESERVED_NAMES.filter((name) => name !== 'index.html')

const REQUIRED_FIELDS = ['id', 'label', 'tool', 'toolVersion', 'modelId', 'generatedAt', 'specVersion']

/** Narrows parsed JSON to an indexable object. Arrays pass, as they do for `typeof x === 'object'`. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** `Array.isArray` widens an `unknown` to `any[]`; this keeps the elements `unknown`. */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isVariant(value: unknown): value is Variant {
  if (!isRecord(value)) return false
  for (const field of REQUIRED_FIELDS) {
    const entry = value[field]
    if (typeof entry !== 'string' || entry.length === 0) return false
  }
  return typeof value.attempts === 'number' && Number.isInteger(value.attempts) && value.attempts >= 1
}

/**
 * Structural narrowing of a parsed registry. It repeats the subset of the rules in
 * `validateRegistry` that establish the type, so a registry that validated without errors always
 * satisfies it; callers use it to turn parsed JSON into a `Registry` without a type assertion.
 */
export function isRegistry(value: unknown): value is Registry {
  if (!isRecord(value)) return false
  if (typeof value.default !== 'string') return false
  if (!isArray(value.variants) || !value.variants.every(isVariant)) return false
  const contact = value.contact
  if (!isRecord(contact)) return false
  if (typeof contact.linkedin !== 'string' || typeof contact.github !== 'string') return false
  if (typeof value.repository !== 'string') return false
  return value.specVersion === undefined || typeof value.specVersion === 'string'
}

/** Checks `variants.json` and returns one message per broken rule. */
export function validateRegistry(registry: unknown, context: RegistryContext = {}): string[] {
  const { variantFolders = [], defaultTopLevelEntries = [], specVersions = [] } = context
  const errors: string[] = []

  if (!isRecord(registry)) return ['variants.json: the registry must be an object']
  if (!isArray(registry.variants) || registry.variants.length === 0) {
    errors.push('variants.json: "variants" must be a non-empty array')
    return errors
  }

  const seen = new Set<string>()
  for (const [index, entry] of registry.variants.entries()) {
    const where = `variants[${index}]`
    const variant = isRecord(entry) ? entry : undefined
    for (const field of REQUIRED_FIELDS) {
      const value = variant?.[field]
      if (typeof value !== 'string' || value.length === 0) {
        errors.push(`${where}: "${field}" is required and must be a non-empty string`)
      }
    }
    const attempts = variant?.attempts
    if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1) {
      errors.push(`${where}: "attempts" must be an integer of at least 1`)
    }
    const specVersion = variant?.specVersion
    if (typeof specVersion === 'string' && specVersion.length > 0 && !specVersions.includes(specVersion)) {
      errors.push(`${where}: specVersion "${specVersion}" has no specification at spec/${specVersion}.md`)
    }
    const id = variant?.id
    if (typeof id !== 'string') continue
    if (!ID_PATTERN.test(id)) errors.push(`${where}: id "${id}" does not match the pattern ${ID_PATTERN}`)
    if (RESERVED_NAMES.includes(id.toLowerCase())) errors.push(`${where}: id "${id}" is a reserved name`)
    if (seen.has(id)) errors.push(`${where}: duplicate id "${id}"`)
    seen.add(id)
    if (!variantFolders.includes(id)) errors.push(`${where}: id "${id}" has no folder at variants/${id}`)
  }

  const defaultId = registry.default
  if (typeof defaultId !== 'string' || !seen.has(defaultId)) {
    errors.push(`variants.json: "default" must name a registered variant, found "${String(defaultId)}"`)
  }

  for (const id of seen) {
    if (id !== defaultId && defaultTopLevelEntries.includes(id)) {
      errors.push(`variants.json: id "${id}" collides with a top-level entry of the default variant`)
    }
  }

  for (const folder of variantFolders) {
    if (!seen.has(folder)) errors.push(`variants/${folder}: folder has no entry in variants.json`)
  }

  const contact = registry.contact
  if (!isRecord(contact)) {
    errors.push('variants.json: "contact" must be an object with linkedin and github')
  } else {
    for (const key of ['linkedin', 'github']) {
      const value = contact[key]
      if (typeof value !== 'string' || !value.startsWith('https://')) {
        errors.push(`variants.json: contact.${key} must be an https URL`)
      }
    }
  }

  const repository = registry.repository
  if (typeof repository !== 'string' || !repository.startsWith('https://')) {
    errors.push('variants.json: "repository" must be an https URL')
  }

  return errors
}
