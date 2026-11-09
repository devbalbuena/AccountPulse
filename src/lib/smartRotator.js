import { evaluateAccountStatus } from './durationUtils'

/**
 * 1-Click Smart Auto-Rotator
 * Picks the best ready account (prioritizing pinned accounts, then the longest-idle ready timer)
 * so the user can copy its email and start its cooldown in a single click.
 */
export function pickBestReadyAccount(accounts = [], now = Date.now(), pinnedIds = []) {
  const pinnedSet = new Set(pinnedIds || [])
  const candidates = []

  for (const acc of accounts) {
    if (!acc || acc.deleted_at) continue
    const status = evaluateAccountStatus(acc, now)
    if (!status.isReady || !status.groups) continue

    for (const grp of status.groups) {
      if (!grp.isReady) continue
      const drainableTimers = (grp.timers || []).filter(
        t => !t.deleted_at && (t.interval_hours || 0) > 0
      )
      if (drainableTimers.length === 0) continue

      const primaryTimer = drainableTimers[0]
      const lastRefreshedMs = primaryTimer.last_refreshed_at
        ? new Date(primaryTimer.last_refreshed_at).getTime()
        : 0

      candidates.push({
        account: acc,
        group: grp,
        timer: primaryTimer,
        allGroupTimers: drainableTimers,
        isPinned: pinnedSet.has(acc.id),
        lastRefreshedMs: isNaN(lastRefreshedMs) ? 0 : lastRefreshedMs,
      })
      break
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    if (a.lastRefreshedMs !== b.lastRefreshedMs) return a.lastRefreshedMs - b.lastRefreshedMs
    return (a.account.email || '').localeCompare(b.account.email || '')
  })

  return candidates[0]
}
