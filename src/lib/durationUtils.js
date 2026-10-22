/**
 * Utility functions for durations, timer grouping, and cooldown calculations
 */

/**
 * Calculates a future Date by adding days, hours, and minutes to a base date.
 * @param {number} days 
 * @param {number} hours 
 * @param {number} minutes 
 * @param {Date} [fromDate=new Date()]
 * @returns {Date}
 */
export function addDuration(days = 0, hours = 0, minutes = 0, fromDate = new Date()) {
  const d = Math.max(0, parseInt(days, 10) || 0)
  const h = Math.max(0, parseInt(hours, 10) || 0)
  const m = Math.max(0, parseInt(minutes, 10) || 0)
  const totalMs = ((d * 24 + h) * 60 + m) * 60 * 1000
  return new Date(fromDate.getTime() + totalMs)
}

/**
 * Formats a millisecond duration into a clean human-readable string (e.g. "6d 23h", "4h 15m", "35m").
 * @param {number} ms 
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m'
  const totalSeconds = Math.floor(ms / 1000)
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)

  if (d > 0) {
    return h > 0 ? `${d}d ${h}h` : `${d}d`
  }
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${Math.max(1, m)}m`
}

/**
 * Formats a Date object into local formatted preview (e.g. "Oct 29, 3:40 PM").
 * @param {Date|string} date 
 * @returns {string}
 */
export function formatRefreshPreview(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Groups an array of token_timers by group_name (falling back to model_name).
 * Filters out any soft-deleted timers.
 * @param {Array} timers 
 * @returns {Record<string, Array>}
 */
export function groupTimers(timers = []) {
  const groups = {}
  for (const timer of timers) {
    if (timer.deleted_at) continue // Ignore soft-deleted timers
    const key = (timer.group_name || timer.model_name || 'General').trim()
    if (!groups[key]) groups[key] = []
    groups[key].push(timer)
  }
  return groups
}

/**
 * Calculates the state of a single group of timers.
 * - Handles null next_due_at: treated as not cooling down (ready).
 * - Handles single-timer groups: solely determined by that single timer.
 * - Soft-deleted timers: ignored.
 * A group is Ready ONLY when ALL active timers in that group are due (next_due_at <= now).
 * When on cooldown, it displays the LONGER remaining time among the timers in that group.
 * @param {Array} groupTimersList 
 * @param {number} [now=Date.now()]
 */
export function evaluateGroupStatus(groupTimersList = [], now = Date.now()) {
  const activeTimers = groupTimersList.filter(t => !t.deleted_at)
  if (!activeTimers.length) {
    return { isReady: true, maxRemainingMs: 0, formatted: 'Ready', primaryColor: '#10b981' }
  }

  let allDue = true
  let maxRemainingMs = 0
  let primaryColor = activeTimers[0]?.color || '#2563eb'

  for (const timer of activeTimers) {
    // A timer with no next_due_at is not on cooldown
    if (!timer.next_due_at) continue

    const dueTime = new Date(timer.next_due_at).getTime()
    if (isNaN(dueTime)) continue

    const diff = dueTime - now
    if (diff > 0) {
      allDue = false
      if (diff > maxRemainingMs) {
        maxRemainingMs = diff
        if (timer.color) primaryColor = timer.color
      }
    }
  }

  return {
    isReady: allDue,
    maxRemainingMs,
    formatted: allDue ? 'Ready' : formatDuration(maxRemainingMs),
    primaryColor
  }
}

/**
 * Calculates the overall status of an account.
 * - Soft-deleted accounts (deleted_at set) return isDeleted: true, isReady: false.
 * - Accounts with no active timers return isReady: true, groups: [].
 * - An account is "Ready now" if AT LEAST ONE group is Ready!
 * @param {Object} account 
 * @param {number} [now=Date.now()]
 */
export function evaluateAccountStatus(account, now = Date.now()) {
  if (!account || account.deleted_at) {
    return { isReady: false, isDeleted: true, groups: [], soonestAvailableMs: 0 }
  }

  const timers = (account.token_timers || []).filter(t => !t.deleted_at)
  if (timers.length === 0) {
    return { isReady: false, hasTimers: false, groups: [], soonestAvailableMs: 0 }
  }

  const grouped = groupTimers(timers)
  const groupResults = []
  let atLeastOneReady = false
  let minCooldownMs = Infinity

  for (const [groupName, timersList] of Object.entries(grouped)) {
    const status = evaluateGroupStatus(timersList, now)
    groupResults.push({
      groupName,
      timers: timersList,
      ...status
    })

    if (status.isReady) {
      atLeastOneReady = true
    } else if (status.maxRemainingMs > 0 && status.maxRemainingMs < minCooldownMs) {
      minCooldownMs = status.maxRemainingMs
    }
  }

  return {
    isReady: atLeastOneReady,
    groups: groupResults,
    soonestAvailableMs: minCooldownMs === Infinity ? 0 : minCooldownMs
  }
}
