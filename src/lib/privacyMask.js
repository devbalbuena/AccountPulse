import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'ap_privacy_blur'

/**
 * Check if Privacy / Screen-Share Mode is currently enabled.
 * @returns {boolean}
 */
export function isPrivacyMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Toggle Privacy / Screen-Share Mode.
 * @returns {boolean} new privacy state
 */
export function togglePrivacyMode() {
  const next = !isPrivacyMode()
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
    window.dispatchEvent(new CustomEvent('ap:privacy-updated', { detail: next }))
  } catch {
    // ignore storage errors
  }
  return next
}

/**
 * Mask an email handle for screen-sharing while preserving domain readability.
 * Example: "dexter.balbuena@urios.edu.ph" -> "dex***@urios.edu.ph"
 * @param {string} email
 * @param {boolean} [enabled]
 * @returns {string}
 */
export function maskEmail(email, enabled = isPrivacyMode()) {
  if (!email || !enabled) return email || ''
  const str = String(email)
  const atIdx = str.indexOf('@')
  if (atIdx <= 0) {
    return str.length <= 3 ? `${str[0] || '*'}***` : `${str.slice(0, 3)}***`
  }
  const userPart = str.slice(0, atIdx)
  const domainPart = str.slice(atIdx)
  const visibleChars = userPart.length <= 3 ? userPart.slice(0, 1) : userPart.slice(0, 3)
  return `${visibleChars}***${domainPart}`
}

/**
 * React hook for Privacy / Screen-Share Mode.
 */
export function usePrivacyMode() {
  const [privacyMode, setPrivacyMode] = useState(() => isPrivacyMode())

  useEffect(() => {
    function handleUpdate() {
      setPrivacyMode(isPrivacyMode())
    }
    window.addEventListener('ap:privacy-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('ap:privacy-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const togglePrivacy = useCallback(() => {
    const next = togglePrivacyMode()
    setPrivacyMode(next)
    return next
  }, [])

  const mask = useCallback(
    (email) => maskEmail(email, privacyMode),
    [privacyMode]
  )

  return { privacyMode, togglePrivacy, mask }
}
