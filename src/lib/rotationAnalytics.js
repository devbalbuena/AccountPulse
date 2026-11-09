/**
 * Quota Rotation History & Fleet Utilization Analytics
 * Combines local rotation events, Supabase notifications drain logs, and timer last_refreshed_at
 * to show how many times each account was drained/rotated per day and week, and which accounts are sitting idle.
 */

const ROTATION_STORAGE_KEY = 'ap_rotation_history'

export function recordRotationEvent({ accountId, email, platform, modelName }) {
  try {
    const raw = localStorage.getItem(ROTATION_STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    const entry = {
      id: `${accountId || email}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      accountId,
      email,
      platform: platform || 'AI Platform',
      modelName: modelName || 'Timer',
      timestamp: new Date().toISOString(),
    }
    const updated = [entry, ...(Array.isArray(list) ? list : [])].slice(0, 500)
    localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(updated))
    return entry
  } catch {
    return null
  }
}

export function getLocalRotationEvents() {
  try {
    const raw = localStorage.getItem(ROTATION_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Computes comprehensive rotation analytics across all active accounts
 */
export function computeRotationAnalytics(accounts = [], notifications = []) {
  const localEvents = getLocalRotationEvents()
  const nowMs = Date.now()
  const dayMs = 86400000
  const weekMs = 7 * dayMs

  // Map accountId -> { account, count24h, count7d, countTotal, lastRotatedMs }
  const statsMap = new Map()
  accounts.forEach(acc => {
    statsMap.set(acc.id, {
      account: acc,
      email: acc.email,
      platform: acc.platform,
      count24h: 0,
      count7d: 0,
      countTotal: 0,
      lastRotatedMs: 0,
    })
  })

  const seenFingerprints = new Set()

  function addHit(acc, tsMs) {
    if (!acc || !tsMs || isNaN(tsMs)) return
    const bucket = Math.floor(tsMs / 60000) // 1-minute deduplication window per account
    const fp = `${acc.id}:${bucket}`
    if (seenFingerprints.has(fp)) return
    seenFingerprints.add(fp)

    const st = statsMap.get(acc.id)
    if (!st) return
    st.countTotal++
    if (nowMs - tsMs <= dayMs) st.count24h++
    if (nowMs - tsMs <= weekMs) st.count7d++
    if (tsMs > st.lastRotatedMs) st.lastRotatedMs = tsMs
  }

  // 1. Local rotation history events
  localEvents.forEach(ev => {
    const acc = accounts.find(a => a.id === ev.accountId || a.email === ev.email)
    if (acc && ev.timestamp) {
      addHit(acc, new Date(ev.timestamp).getTime())
    }
  })

  // 2. Notifications table drain logs
  notifications.forEach(n => {
    const msg = (n.message || '').toLowerCase()
    if (msg.includes('drained') || msg.includes('cooldown')) {
      const acc = accounts.find(a => a.email && msg.includes(a.email.toLowerCase()))
      if (acc && n.created_at) {
        addHit(acc, new Date(n.created_at).getTime())
      }
    }
  })

  // 3. Token timers last_refreshed_at timestamps
  accounts.forEach(acc => {
    ;(acc.token_timers || []).forEach(t => {
      if (t.last_refreshed_at) {
        addHit(acc, new Date(t.last_refreshed_at).getTime())
      }
    })
  })

  const accountStats = Array.from(statsMap.values()).sort((a, b) => {
    if (b.count7d !== a.count7d) return b.count7d - a.count7d
    if (b.countTotal !== a.countTotal) return b.countTotal - a.countTotal
    return a.email.localeCompare(b.email)
  })

  const totalRotations24h = accountStats.reduce((s, x) => s + x.count24h, 0)
  const totalRotations7d = accountStats.reduce((s, x) => s + x.count7d, 0)
  const idleAccountsCount = accountStats.filter(x => x.count7d === 0).length

  return {
    totalRotations24h,
    totalRotations7d,
    idleAccountsCount,
    accountStats,
  }
}
