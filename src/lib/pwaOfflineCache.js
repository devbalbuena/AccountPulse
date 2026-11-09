/**
 * PWA Service Worker Registration & Offline Fleet Cache
 * Persists accounts, active timers, and subscriptions locally so countdowns
 * continue ticking accurately even when the user goes offline.
 */

const CACHE_PREFIX = 'ap_offline_cache_'

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  // Only register in production or localhost
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration skipped:', err?.message)
    })
  })
}

export function saveOfflineCache(key, data) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        data,
      })
    )
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineCache(key, fallback = []) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed?.data ?? fallback
  } catch {
    return fallback
  }
}
