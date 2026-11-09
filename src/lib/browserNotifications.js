/**
 * Browser Native Push Notifications (Web Notifications API)
 * Triggers desktop & mobile browser notifications when a cooldown timer hits zero,
 * even when the user is on another tab or window.
 */

const STORAGE_KEY = 'ap_browser_push_enabled'

export function isBrowserPushSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getBrowserPushPermission() {
  if (!isBrowserPushSupported()) return 'unsupported'
  return Notification.permission
}

export function isBrowserPushEnabled() {
  if (!isBrowserPushSupported()) return false
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) {
    return Notification.permission === 'granted'
  }
  return stored === 'true'
}

export function setBrowserPushEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, String(Boolean(enabled)))
}

export async function requestBrowserPushPermission() {
  if (!isBrowserPushSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      setBrowserPushEnabled(true)
    }
    return result
  } catch (err) {
    console.warn('Failed to request notification permission:', err)
    return 'denied'
  }
}

export function sendBrowserNotification(title, { body = '', tag = undefined, onClick = null } = {}) {
  if (!isBrowserPushSupported()) return false
  if (!isBrowserPushEnabled()) return false
  if (Notification.permission !== 'granted') return false

  try {
    const notif = new Notification(title, {
      body,
      tag,
      renotify: Boolean(tag),
      silent: false,
    })

    notif.onclick = () => {
      try {
        window.focus()
        if (typeof onClick === 'function') onClick()
        notif.close()
      } catch {
        // ignore focus errors
      }
    }
    return true
  } catch (err) {
    console.warn('Browser notification error:', err)
    return false
  }
}
