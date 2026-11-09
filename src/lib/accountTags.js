/**
 * Custom Account Tags & Multi-Filter Helper
 * Stores custom tags in localStorage and syncs #hashtag tokens in account.notes
 * so tags work seamlessly without requiring SQL schema migrations.
 */

const TAGS_STORAGE_KEY = 'ap_account_tags'

export const SUGGESTED_TAGS = ['Work', 'Personal', 'Team-A', 'Backup', 'Priority', 'Client']

function getTagsMap() {
  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

export function normalizeTag(raw = '') {
  return String(raw)
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
}

export function extractHashtagsFromNotes(notes = '') {
  if (!notes) return []
  const matches = notes.match(/#[a-zA-Z0-9_-]+/g) || []
  return matches.map(m => normalizeTag(m)).filter(Boolean)
}

export function getAccountTags(account) {
  if (!account) return []
  const map = getTagsMap()
  const stored = Array.isArray(map[account.id]) ? map[account.id] : []
  const fromNotes = extractHashtagsFromNotes(account.notes)
  const merged = new Set([...stored, ...fromNotes].map(normalizeTag).filter(Boolean))
  return Array.from(merged)
}

export function setAccountTags(accountId, tags = []) {
  if (!accountId) return []
  const clean = Array.from(new Set(tags.map(normalizeTag).filter(Boolean)))
  const map = getTagsMap()
  map[accountId] = clean
  localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(map))
  return clean
}

export function syncTagsIntoNotes(notes = '', tags = []) {
  const stripped = (notes || '')
    .replace(/(?:^|\s)#[a-zA-Z0-9_-]+/g, '')
    .trim()
  const cleanTags = Array.from(new Set(tags.map(normalizeTag).filter(Boolean)))
  if (cleanTags.length === 0) return stripped
  const tagLine = cleanTags.map(t => `#${t}`).join(' ')
  return stripped ? `${stripped}\n${tagLine}` : tagLine
}

export function stripHashtagsFromNotes(notes = '') {
  if (!notes) return ''
  return notes.replace(/(?:^|\s)#[a-zA-Z0-9_-]+/g, '').trim()
}
