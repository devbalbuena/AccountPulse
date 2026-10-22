import { evaluateAccountStatus } from './durationUtils'

// Module-level map tracking the last observed state of each group: `${acc.id}:${groupName}` -> 'ready' | 'cooldown'
const groupStates = new Map()
let isInitialized = false

/**
 * Evaluates all accounts and fires a Quota Ready toast once when a whole group
 * (all timers in that group) transitions from cooldown to ready while the app is running.
 * 
 * - Does NOT fire on page load for groups that were already ready.
 * - Does NOT repeat.
 * - Operates on the full accounts list, so it continues monitoring even when accounts
 *   are filtered out of view by UI tabs or search queries.
 * 
 * @param {Array} accounts 
 * @param {number} now 
 * @param {Function} addToast 
 */
export function checkGroupReadyTransitions(accounts = [], now = Date.now(), addToast) {
  if (!accounts || accounts.length === 0 || typeof addToast !== 'function') return

  for (const acc of accounts) {
    if (acc.deleted_at) continue

    const { groups, hasTimers } = evaluateAccountStatus(acc, now)
    if (hasTimers === false || !groups) continue

    for (const group of groups) {
      const groupKey = `${acc.id}:${group.groupName}`
      const prevState = groupStates.get(groupKey)

      if (!isInitialized || !groupStates.has(groupKey)) {
        // Initial observation: record initial state with NO toast
        groupStates.set(groupKey, group.isReady ? 'ready' : 'cooldown')
        continue
      }

      if (prevState === 'cooldown' && group.isReady) {
        // Whole group transitioned from cooldown to ready while app is open!
        groupStates.set(groupKey, 'ready')
        addToast({
          type: 'ready',
          message: `${acc.email} — ${group.groupName} quota is ready to use!`
        })
      } else if (!group.isReady && prevState === 'ready') {
        // Re-armed when user drains the group or sets a timer
        groupStates.set(groupKey, 'cooldown')
      }
    }
  }

  isInitialized = true
}

/**
 * Resets notification watcher state (useful for tests or logout)
 */
export function resetGroupReadyWatcher() {
  groupStates.clear()
  isInitialized = false
}
