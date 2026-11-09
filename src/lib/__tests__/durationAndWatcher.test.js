import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  addDuration,
  formatDuration,
  groupTimers,
  evaluateGroupStatus,
  evaluateAccountStatus,
} from '../durationUtils'
import {
  checkGroupReadyTransitions,
  resetGroupReadyWatcher,
} from '../groupNotificationWatcher'
import { convertAmount, DEFAULT_USD_RATES } from '../currencyConverter'

describe('durationUtils — countdown math & formatting', () => {
  it('adds days, hours, and minutes accurately to a base timestamp', () => {
    const base = new Date('2026-11-01T00:00:00.000Z')
    const result = addDuration(6, 23, 30, base)
    const expectedMs = ((6 * 24 + 23) * 60 + 30) * 60 * 1000
    expect(result.getTime() - base.getTime()).toBe(expectedMs)
  })

  it('formats durations into human-readable strings', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(-5000)).toBe('0m')
    expect(formatDuration(30 * 1000)).toBe('1m')
    expect(formatDuration(45 * 60 * 1000)).toBe('45m')
    expect(formatDuration((4 * 60 + 15) * 60 * 1000)).toBe('4h 15m')
    expect(formatDuration((6 * 24 + 23) * 3600 * 1000)).toBe('6d 23h')
  })

  it('groups active timers by group_name and ignores soft-deleted timers', () => {
    const timers = [
      { id: '1', model_name: 'Gemini Weekly', group_name: 'Gemini', deleted_at: null },
      { id: '2', model_name: 'Gemini 5h', group_name: 'Gemini', deleted_at: null },
      { id: '3', model_name: 'Claude 4.6', group_name: 'Claude / GPT', deleted_at: '2026-10-01T00:00:00Z' },
    ]
    const grouped = groupTimers(timers)
    expect(Object.keys(grouped)).toEqual(['Gemini'])
    expect(grouped['Gemini']).toHaveLength(2)
  })

  it('marks a group as Ready ONLY when all timers in that group are due', () => {
    const now = new Date('2026-11-09T12:00:00.000Z').getTime()
    const readyTimer = {
      id: 't1',
      model_name: 'Gemini 5h',
      group_name: 'Gemini',
      next_due_at: '2026-11-09T11:00:00.000Z',
    }
    const coolingTimer = {
      id: 't2',
      model_name: 'Gemini Weekly',
      group_name: 'Gemini',
      next_due_at: '2026-11-10T12:00:00.000Z',
    }

    const mixedStatus = evaluateGroupStatus([readyTimer, coolingTimer], now)
    expect(mixedStatus.isReady).toBe(false)
    expect(mixedStatus.formatted).toBe('1d')

    const allReadyStatus = evaluateGroupStatus([readyTimer], now)
    expect(allReadyStatus.isReady).toBe(true)
    expect(allReadyStatus.formatted).toBe('Ready')
  })

  it('evaluates account status as Ready when at least one model group is Ready', () => {
    const now = new Date('2026-11-09T12:00:00.000Z').getTime()
    const account = {
      id: 'acc-1',
      email: 'dev@example.com',
      deleted_at: null,
      token_timers: [
        {
          id: 't1',
          model_name: 'Gemini Weekly',
          group_name: 'Gemini',
          next_due_at: '2026-11-10T12:00:00.000Z', // cooling down
        },
        {
          id: 't2',
          model_name: 'Claude Weekly',
          group_name: 'Claude / GPT',
          next_due_at: '2026-11-09T10:00:00.000Z', // ready
        },
      ],
    }

    const status = evaluateAccountStatus(account, now)
    expect(status.isReady).toBe(true)
    expect(status.groups).toHaveLength(2)
    expect(status.soonestAvailableMs).toBe(24 * 3600 * 1000)
  })
})

describe('groupNotificationWatcher — transition alerts', () => {
  beforeEach(() => {
    resetGroupReadyWatcher()
  })

  it('does NOT fire a toast on initial load, fires once on cooldown->ready transition, and re-arms on drain', () => {
    const addToast = vi.fn()
    const t0 = new Date('2026-11-09T12:00:00.000Z').getTime()
    const dueAt = '2026-11-09T12:05:00.000Z'

    const accCooling = {
      id: 'acc-1',
      email: 'user@example.com',
      platform: 'Antigravity IDE 2.0',
      deleted_at: null,
      token_timers: [
        {
          id: 't1',
          model_name: 'Gemini Weekly',
          group_name: 'Gemini',
          next_due_at: dueAt,
        },
      ],
    }

    // 1. Initial observation while cooling down -> no toast
    checkGroupReadyTransitions([accCooling], t0, addToast)
    expect(addToast).not.toHaveBeenCalled()

    // 2. Time advances past dueAt -> transitions cooldown -> ready -> fires 1 toast
    const t1 = new Date('2026-11-09T12:06:00.000Z').getTime()
    checkGroupReadyTransitions([accCooling], t1, addToast)
    expect(addToast).toHaveBeenCalledTimes(1)
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ready',
        message: expect.stringContaining('user@example.com — Gemini quota is ready'),
      })
    )

    // 3. Subsequent ticks while still ready -> does NOT repeat toast
    checkGroupReadyTransitions([accCooling], t1 + 1000, addToast)
    expect(addToast).toHaveBeenCalledTimes(1)

    // 4. User drains the group (next_due_at pushed into future) -> re-arms watcher
    const accDrained = {
      ...accCooling,
      token_timers: [
        {
          id: 't1',
          model_name: 'Gemini Weekly',
          group_name: 'Gemini',
          next_due_at: '2026-11-09T17:06:00.000Z',
        },
      ],
    }
    checkGroupReadyTransitions([accDrained], t1 + 2000, addToast)
    expect(addToast).toHaveBeenCalledTimes(1)

    // 5. Cooldown finishes again -> fires a second toast
    const t2 = new Date('2026-11-09T17:07:00.000Z').getTime()
    checkGroupReadyTransitions([accDrained], t2, addToast)
    expect(addToast).toHaveBeenCalledTimes(2)
  })
})

describe('currencyConverter — multi-currency conversion', () => {
  it('converts between USD, PHP, and EUR accurately', () => {
    expect(convertAmount(100, 'PHP', 'PHP', DEFAULT_USD_RATES)).toBe(100)
    const usdToPhp = convertAmount(10, 'USD', 'PHP', DEFAULT_USD_RATES)
    expect(usdToPhp).toBeCloseTo(582, 1)
  })
})
