import { supabase } from './supabase'
import { getCustomPresets } from './timerPresets'
import { getWebhookConfig } from './webhookDispatcher'
import { getAccountTags } from './accountTags'

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeCSV(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportAccountsCSV(accounts = []) {
  const headers = ['Email', 'Platform', 'Category', 'Tags', 'Models / Timers', 'Created At']
  const rows = accounts.map(acc => {
    const tags = getAccountTags(acc).map(t => `#${t}`).join(' ')
    const timers = (acc.token_timers || [])
      .filter(t => !t.deleted_at)
      .map(t => `${t.model_name || 'Model'} (${t.interval_hours || 0}h)`)
      .join('; ')
    return [
      escapeCSV(acc.email),
      escapeCSV(acc.platform),
      escapeCSV(acc.type),
      escapeCSV(tags),
      escapeCSV(timers),
      escapeCSV(acc.created_at),
    ].join(',')
  })

  const dateStr = new Date().toISOString().slice(0, 10)
  downloadBlob([headers.join(','), ...rows].join('\n'), `accountpulse-accounts-${dateStr}.csv`, 'text/csv;charset=utf-8;')
}

export function exportSubscriptionsCSV(subs = []) {
  const headers = ['Service Name', 'Category', 'Currency', 'Amount', 'Billing Interval', 'Next Billing Date', 'Payment Method', 'Status']
  const rows = subs.map(s => [
    escapeCSV(s.service_name),
    escapeCSV(s.category || ''),
    escapeCSV(s.currency || 'PHP'),
    escapeCSV(s.amount),
    escapeCSV(s.billing_interval || 'monthly'),
    escapeCSV(s.next_billing_date ? s.next_billing_date.slice(0, 10) : ''),
    escapeCSV(s.payment_method || ''),
    escapeCSV(s.paused_at ? 'Paused' : 'Active'),
  ].join(','))

  const dateStr = new Date().toISOString().slice(0, 10)
  downloadBlob([headers.join(','), ...rows].join('\n'), `accountpulse-subscriptions-${dateStr}.csv`, 'text/csv;charset=utf-8;')
}

export async function exportFullBackupJSON(userId) {
  const [{ data: accounts }, { data: subscriptions }] = await Promise.all([
    supabase.from('accounts').select('*, token_timers(*)').eq('user_id', userId),
    supabase.from('subscriptions').select('*').eq('user_id', userId),
  ])

  const payload = {
    version: '2.0',
    exported_at: new Date().toISOString(),
    accounts: accounts || [],
    subscriptions: subscriptions || [],
    custom_timer_presets: getCustomPresets(),
    webhook_config: getWebhookConfig(),
    account_tags: JSON.parse(localStorage.getItem('ap_account_tags') || '{}'),
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  downloadBlob(JSON.stringify(payload, null, 2), `accountpulse-backup-${dateStr}.json`, 'application/json')
  return payload
}

export async function restoreFromBackupJSON(userId, jsonData) {
  const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file format.')
  }

  let restoredAccounts = 0
  let restoredSubs = 0

  // Restore local preferences if present
  if (Array.isArray(parsed.custom_timer_presets)) {
    localStorage.setItem('ap_custom_timer_presets', JSON.stringify(parsed.custom_timer_presets))
  }
  if (parsed.account_tags && typeof parsed.account_tags === 'object') {
    const current = JSON.parse(localStorage.getItem('ap_account_tags') || '{}')
    localStorage.setItem('ap_account_tags', JSON.stringify({ ...current, ...parsed.account_tags }))
  }

  // Fetch existing accounts & subscriptions to avoid duplicating existing records
  const [{ data: existingAccs }, { data: existingSubs }] = await Promise.all([
    supabase.from('accounts').select('id, email, platform').eq('user_id', userId),
    supabase.from('subscriptions').select('id, service_name').eq('user_id', userId),
  ])

  const existingAccSet = new Set(
    (existingAccs || []).map(a => `${a.email.toLowerCase()}:::${(a.platform || '').toLowerCase()}`)
  )
  const existingSubSet = new Set(
    (existingSubs || []).map(s => (s.service_name || '').toLowerCase())
  )

  if (Array.isArray(parsed.accounts)) {
    for (const acc of parsed.accounts) {
      if (!acc.email) continue
      const key = `${acc.email.toLowerCase()}:::${(acc.platform || '').toLowerCase()}`
      if (existingAccSet.has(key)) continue

      const { data: insertedAcc, error: accErr } = await supabase
        .from('accounts')
        .insert({
          user_id: userId,
          email: acc.email,
          platform: acc.platform || 'AI Platform',
          type: acc.type || 'Coding',
          notes: acc.notes || null,
          icon_url: acc.icon_url || null,
          deleted_at: acc.deleted_at || null,
        })
        .select()
        .single()

      if (!accErr && insertedAcc) {
        restoredAccounts++
        if (Array.isArray(acc.token_timers) && acc.token_timers.length > 0) {
          const timersToInsert = acc.token_timers.map(t => ({
            account_id: insertedAcc.id,
            model_name: t.model_name || 'Model',
            group_name: t.group_name || null,
            color: t.color || '#2563eb',
            interval_hours: t.interval_hours || 5,
            next_due_at: t.next_due_at || new Date().toISOString(),
            last_refreshed_at: t.last_refreshed_at || null,
            notify_on_ready: Boolean(t.notify_on_ready),
          }))
          await supabase.from('token_timers').insert(timersToInsert)
        }
      }
    }
  }

  if (Array.isArray(parsed.subscriptions)) {
    for (const sub of parsed.subscriptions) {
      if (!sub.service_name) continue
      if (existingSubSet.has(sub.service_name.toLowerCase())) continue

      const { error: subErr } = await supabase.from('subscriptions').insert({
        user_id: userId,
        service_name: sub.service_name,
        category: sub.category || 'Other',
        amount: sub.amount || 0,
        currency: sub.currency || 'PHP',
        billing_day: sub.billing_day || 1,
        billing_interval: sub.billing_interval || 'monthly',
        custom_interval_days: sub.custom_interval_days || null,
        next_billing_date: sub.next_billing_date || new Date().toISOString(),
        payment_method: sub.payment_method || null,
        notes: sub.notes || null,
        icon_url: sub.icon_url || null,
        paused_at: sub.paused_at || null,
        deleted_at: sub.deleted_at || null,
      })
      if (!subErr) restoredSubs++
    }
  }

  return { restoredAccounts, restoredSubs }
}
