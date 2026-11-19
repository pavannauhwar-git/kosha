// Custom category ids must match ^custom_[a-z0-9_]+$ in the database, but the
// name a person types can be in any script ("किराना", "மளிகை"). The id is
// built from whatever Latin letters the name has plus a random suffix, so a
// non-Latin name still gets a valid id and two names never share one.
const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function normalizeCategoryLabel(label) {
  return String(label ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function categoryLabelKey(label) {
  return normalizeCategoryLabel(label).toLocaleLowerCase()
}

export function categoryLabelError(label) {
  const clean = normalizeCategoryLabel(label)
  const length = [...clean].length
  if (length < 2 || length > 30) return 'Category name must be 2–30 characters'
  if (!/[\p{L}\p{N}]/u.test(clean)) return 'Category name needs at least one letter or number'
  return null
}

export function randomSlugSuffix(length = 6) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length]).join('')
}

export function buildCategorySlug(label, suffix = randomSlugSuffix()) {
  const latin = normalizeCategoryLabel(label)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 20)
    .replace(/_+$/, '')
  return `custom_${latin ? `${latin}_` : ''}${suffix}`
}
