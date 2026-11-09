import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'ap_pinned_accounts'

/**
 * Get the array of pinned account IDs.
 * @returns {string[]}
 */
export function getPinnedAccountIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Check if a given account ID is pinned.
 * @param {string} accountId
 * @returns {boolean}
 */
export function isAccountPinned(accountId) {
  if (!accountId) return false
  return getPinnedAccountIds().includes(accountId)
}

/**
 * Toggle the pinned status of an account ID.
 * @param {string} accountId
 * @returns {{ pinned: boolean, pinnedIds: string[] }}
 */
export function togglePinAccount(accountId) {
  const current = getPinnedAccountIds()
  const exists = current.includes(accountId)
  const next = exists
    ? current.filter(id => id !== accountId)
    : [...current, accountId]

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('ap:pins-updated', { detail: next }))
  } catch {
    // ignore storage errors
  }

  return { pinned: !exists, pinnedIds: next }
}

/**
 * React hook for pinned accounts state.
 */
export function usePinnedAccounts() {
  const [pinnedIds, setPinnedIds] = useState(() => getPinnedAccountIds())

  useEffect(() => {
    function handleUpdate() {
      setPinnedIds(getPinnedAccountIds())
    }
    window.addEventListener('ap:pins-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('ap:pins-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const togglePin = useCallback((accountId) => {
    const res = togglePinAccount(accountId)
    setPinnedIds(res.pinnedIds)
    return res.pinned
  }, [])

  const isPinned = useCallback((accountId) => {
    return pinnedIds.includes(accountId)
  }, [pinnedIds])

  return { pinnedIds, togglePin, isPinned }
}
