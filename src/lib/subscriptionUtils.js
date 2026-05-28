/**
 * Given a billing_day (1-31), compute the next billing date from today.
 * If the billing day this month has already passed, rolls to next month.
 */
export function computeNextBillingDate(billingDay) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  // Try this month first
  let candidate = new Date(year, month, billingDay)

  // If today is past or equal to the billing day this month, go next month
  if (candidate <= today) {
    candidate = new Date(year, month + 1, billingDay)
  }

  // Handle months where billing_day exceeds days in month (e.g. day 31 in February)
  // new Date(year, month+1, 31) auto-overflows, so we clamp it
  const maxDay = new Date(year, candidate.getMonth() + 1, 0).getDate()
  if (billingDay > maxDay) {
    candidate = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0)
  }

  return candidate.toISOString().split('T')[0] // return as YYYY-MM-DD
}
