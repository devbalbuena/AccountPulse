/**
 * Subscription Calendar (.ics) Export & Free Trial Detection Utilities
 */

/**
 * Determine whether a subscription is a free trial.
 * Checks status, category, service_name, or notes for "trial".
 * @param {object} sub
 * @returns {boolean}
 */
export function isTrialSubscription(sub) {
  if (!sub) return false
  const text = [sub.status, sub.category, sub.service_name, sub.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /\btrial\b/.test(text)
}

function formatICSDate(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

function escapeICS(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Generate RFC 5545 .ics calendar content for subscription renewals.
 * @param {Array} subscriptions
 * @returns {string}
 */
export function generateSubscriptionsICS(subscriptions = []) {
  const validSubs = (subscriptions || []).filter(
    s => s && s.next_billing_date && s.status !== 'cancelled'
  )

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AccountPulse//Subscription Renewal Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const sub of validSubs) {
    const dtStart = formatICSDate(sub.next_billing_date)
    if (!dtStart) continue

    const isTrial = isTrialSubscription(sub)
    const amountStr = `${sub.currency || 'PHP'} ${(parseFloat(sub.amount) || 0).toFixed(2)}`
    const titlePrefix = isTrial ? '[TRIAL ENDS] ' : '[Renewal] '
    const summary = `${titlePrefix}${sub.service_name || 'Subscription'} (${amountStr})`
    const descParts = [
      `Service: ${sub.service_name || 'Subscription'}`,
      `Amount: ${amountStr} (${sub.billing_cycle || 'monthly'})`,
      sub.category ? `Category: ${sub.category}` : null,
      sub.notes ? `Notes: ${sub.notes}` : null,
    ].filter(Boolean)

    lines.push(
      'BEGIN:VEVENT',
      `UID:accountpulse-sub-${sub.id || Math.random().toString(36).slice(2)}@accountpulse.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(descParts.join('\n'))}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Reminder: ${escapeICS(summary)} is due tomorrow`,
      'END:VALARM',
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/**
 * Trigger a browser download of the .ics file.
 * @param {Array} subscriptions
 */
export function exportSubscriptionsICS(subscriptions = []) {
  const icsContent = generateSubscriptionsICS(subscriptions)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const dateStr = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `accountpulse-renewals-${dateStr}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
