import { useEffect } from 'react'

const CHANNEL_NAME = 'accountpulse_sync'
const STORAGE_KEY = 'ap_cross_tab_sync'

/**
 * Broadcast a state mutation across all open AccountPulse browser tabs.
 * Uses both BroadcastChannel API and localStorage storage event fallback.
 * @param {string} [action='accounts-updated']
 */
export function notifyCrossTabSync(action = 'accounts-updated') {
  const payload = { action, ts: Date.now() }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL_NAME)
      ch.postMessage(payload)
      ch.close()
    }
  } catch {
    // ignore BroadcastChannel errors
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

/**
 * React hook that invokes `onSync` whenever another browser tab broadcasts a mutation.
 * @param {(payload?: { action: string, ts: number }) => void} onSync
 */
export function useCrossTabSync(onSync) {
  useEffect(() => {
    if (typeof onSync !== 'function') return

    let channel = null
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(CHANNEL_NAME)
        channel.onmessage = (event) => {
          onSync(event?.data)
        }
      }
    } catch {
      // ignore BroadcastChannel setup errors
    }

    function handleStorage(e) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          onSync(JSON.parse(e.newValue))
        } catch {
          onSync()
        }
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      if (channel) {
        try {
          channel.close()
        } catch {
          // ignore
        }
      }
    }
  }, [onSync])
}
