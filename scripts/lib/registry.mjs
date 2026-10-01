export const ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/
export const RESERVED_NAMES = ['shell', 'spec', 'index.html', '404.html', 'variants.json', 'cname', '.nojekyll']

const REQUIRED_FIELDS = ['id', 'label', 'tool', 'toolVersion', 'modelId', 'generatedAt', 'specVersion']

export function validateRegistry(registry, context = {}) {
  const { variantFolders = [], defaultTopLevelEntries = [] } = context
  const errors = []

  if (!registry || typeof registry !== 'object') return ['variants.json: the registry must be an object']
  if (!Array.isArray(registry.variants) || registry.variants.length === 0) {
    errors.push('variants.json: "variants" must be a non-empty array')
    return errors
  }

  const seen = new Set()
  for (const [index, variant] of registry.variants.entries()) {
    const where = `variants[${index}]`
    for (const field of REQUIRED_FIELDS) {
      if (typeof variant?.[field] !== 'string' || variant[field].length === 0) {
        errors.push(`${where}: "${field}" is required and must be a non-empty string`)
      }
    }
    if (!Number.isInteger(variant?.attempts) || variant.attempts < 1) {
      errors.push(`${where}: "attempts" must be an integer of at least 1`)
    }
    const id = variant?.id
    if (typeof id !== 'string') continue
    if (!ID_PATTERN.test(id)) errors.push(`${where}: id "${id}" does not match the pattern ${ID_PATTERN}`)
    if (RESERVED_NAMES.includes(id.toLowerCase())) errors.push(`${where}: id "${id}" is a reserved name`)
    if (seen.has(id)) errors.push(`${where}: duplicate id "${id}"`)
    seen.add(id)
    if (!variantFolders.includes(id)) errors.push(`${where}: id "${id}" has no folder at variants/${id}`)
  }

  if (typeof registry.default !== 'string' || !seen.has(registry.default)) {
    errors.push(`variants.json: "default" must name a registered variant, found "${registry.default}"`)
  }

  for (const id of seen) {
    if (id !== registry.default && defaultTopLevelEntries.includes(id)) {
      errors.push(`variants.json: id "${id}" collides with a top-level entry of the default variant`)
    }
  }

  for (const folder of variantFolders) {
    if (!seen.has(folder)) errors.push(`variants/${folder}: folder has no entry in variants.json`)
  }

  const contact = registry.contact
  if (!contact || typeof contact !== 'object') {
    errors.push('variants.json: "contact" must be an object with linkedin and github')
  } else {
    for (const key of ['linkedin', 'github']) {
      const value = contact[key]
      if (typeof value !== 'string' || !value.startsWith('https://')) {
        errors.push(`variants.json: contact.${key} must be an https URL`)
      }
    }
  }

  return errors
}
