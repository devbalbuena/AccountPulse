import { describe, it, expect, beforeEach } from 'vitest'

// Lightweight localStorage & window polyfill for Vitest node environment
const memoryStore = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
  setItem: (k, v) => memoryStore.set(k, String(v)),
  removeItem: (k) => memoryStore.delete(k),
  clear: () => memoryStore.clear(),
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, params) {
      this.type = type
      this.detail = params?.detail
    }
  }
}

import {
  normalizeTag,
  extractHashtagsFromNotes,
  syncTagsIntoNotes,
  stripHashtagsFromNotes,
  setAccountTags,
  getAccountTags,
} from '../accountTags'
import {
  getCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from '../timerPresets'
import {
  recordRotationEvent,
  computeRotationAnalytics,
} from '../rotationAnalytics'
import { pickBestReadyAccount } from '../smartRotator'
import { maskEmail, isPrivacyMode, togglePrivacyMode } from '../privacyMask'
import { isTrialSubscription, generateSubscriptionsICS } from '../calendarExport'

describe('accountTags utilities', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalizes tags and strips leading #', () => {
    expect(normalizeTag('##Team A')).toBe('Team-A')
    expect(normalizeTag('  #Work  ')).toBe('Work')
  })

  it('extracts and syncs hashtags in notes cleanly', () => {
    const notes = 'Primary coding account #Work #Team-A'
    expect(extractHashtagsFromNotes(notes)).toEqual(['Work', 'Team-A'])
    expect(stripHashtagsFromNotes(notes)).toBe('Primary coding account')

    const synced = syncTagsIntoNotes('Primary coding account #OldTag', ['Work', 'Priority'])
    expect(synced).toBe('Primary coding account\n#Work #Priority')
  })

  it('merges localStorage tags with notes hashtags', () => {
    setAccountTags('acc-1', ['Backup'])
    const tags = getAccountTags({ id: 'acc-1', notes: 'Note #Work' })
    expect(tags).toEqual(['Backup', 'Work'])
  })
})

describe('timerPresets persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves, updates, and deletes custom timer presets', () => {
    expect(getCustomPresets()).toEqual([])
    const saved = saveCustomPreset({
      model_name: 'DeepSeek R1 3h',
      group_name: 'DeepSeek',
      interval_days: 0,
      interval_hours: 3,
      color: '#10b981',
    })
    expect(saved.total_hours).toBe(3)
    expect(getCustomPresets()).toHaveLength(1)

    deleteCustomPreset(saved.id)
    expect(getCustomPresets()).toHaveLength(0)
  })
})

describe('rotationAnalytics calculation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('computes 24h, 7d, and idle account metrics accurately', () => {
    const accounts = [
      { id: 'a1', email: 'active@example.com', platform: 'Claude', token_timers: [] },
      { id: 'a2', email: 'idle@example.com', platform: 'Gemini', token_timers: [] },
    ]
    recordRotationEvent({
      accountId: 'a1',
      email: 'active@example.com',
      platform: 'Claude',
      modelName: 'Claude 5h',
    })

    const analytics = computeRotationAnalytics(accounts, [])
    expect(analytics.totalRotations24h).toBe(1)
    expect(analytics.totalRotations7d).toBe(1)
    expect(analytics.idleAccountsCount).toBe(1)
    expect(analytics.accountStats[0].email).toBe('active@example.com')
  })
})

describe('smartRotator selection', () => {
  it('picks the longest-idle ready account and respects pinned priority', () => {
    const now = Date.now()
    const accounts = [
      {
        id: 'recent',
        email: 'recent@example.com',
        token_timers: [
          {
            id: 't1',
            model_name: '5h',
            interval_hours: 5,
            next_due_at: new Date(now - 60000).toISOString(),
            last_refreshed_at: new Date(now - 3600000).toISOString(),
          },
        ],
      },
      {
        id: 'oldest',
        email: 'oldest@example.com',
        token_timers: [
          {
            id: 't2',
            model_name: '5h',
            interval_hours: 5,
            next_due_at: new Date(now - 600000).toISOString(),
            last_refreshed_at: new Date(now - 86400000).toISOString(),
          },
        ],
      },
    ]

    // Without pins, oldest-idle account wins
    const pick1 = pickBestReadyAccount(accounts, now, [])
    expect(pick1.account.id).toBe('oldest')

    // With 'recent' pinned, pinned account wins
    const pick2 = pickBestReadyAccount(accounts, now, ['recent'])
    expect(pick2.account.id).toBe('recent')
  })
})

describe('privacyMask & calendarExport utilities', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('masks email handle when privacy mode is enabled', () => {
    expect(maskEmail('dexter.balbuena@urios.edu.ph', false)).toBe('dexter.balbuena@urios.edu.ph')
    expect(maskEmail('dexter.balbuena@urios.edu.ph', true)).toBe('dex***@urios.edu.ph')
    expect(isPrivacyMode()).toBe(false)
    expect(togglePrivacyMode()).toBe(true)
    expect(isPrivacyMode()).toBe(true)
  })

  it('detects free trial subscriptions and generates valid RFC 5545 .ics calendar', () => {
    const sub1 = {
      id: 'sub-1',
      service_name: 'Cursor Pro',
      amount: 20,
      currency: 'USD',
      next_billing_date: '2026-12-01',
      notes: '14-day free trial',
    }
    const sub2 = {
      id: 'sub-2',
      service_name: 'Spotify',
      amount: 169,
      currency: 'PHP',
      next_billing_date: '2026-12-15',
    }
    expect(isTrialSubscription(sub1)).toBe(true)
    expect(isTrialSubscription(sub2)).toBe(false)

    const ics = generateSubscriptionsICS([sub1, sub2])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('[TRIAL ENDS] Cursor Pro')
    expect(ics).toContain('[Renewal] Spotify')
    expect(ics).toContain('END:VCALENDAR')
  })
})
