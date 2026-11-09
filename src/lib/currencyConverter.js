/**
 * Multi-Currency Live Converter & Exchange Rate Helper
 * Converts mixed USD / EUR / PHP / GBP / SGD / JPY subscriptions into a unified display currency.
 */

const RATES_STORAGE_KEY = 'ap_currency_rates'
const DISPLAY_CUR_KEY = 'ap_display_currency'
const REMINDER_DAYS_KEY = 'ap_renewal_reminder_days'

// Baseline rates relative to 1 USD
export const DEFAULT_USD_RATES = {
  USD: 1,
  PHP: 58.2,
  EUR: 0.92,
  GBP: 0.79,
  SGD: 1.34,
  JPY: 154.5,
  AUD: 1.52,
  CAD: 1.39,
}

export const SUPPORTED_CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'JPY']

export function getSavedRates() {
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_USD_RATES }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_USD_RATES, ...(parsed.rates || {}) }
  } catch {
    return { ...DEFAULT_USD_RATES }
  }
}

export async function refreshLiveExchangeRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) return getSavedRates()
    const data = await res.json()
    if (data && data.rates) {
      const merged = { ...DEFAULT_USD_RATES, ...data.rates }
      localStorage.setItem(
        RATES_STORAGE_KEY,
        JSON.stringify({ updatedAt: new Date().toISOString(), rates: merged })
      )
      return merged
    }
  } catch {
    // Fallback to saved/default rates when offline
  }
  return getSavedRates()
}

export function convertAmount(amount, fromCurrency = 'PHP', toCurrency = 'PHP', rates = DEFAULT_USD_RATES) {
  const num = parseFloat(amount) || 0
  const from = (fromCurrency || 'PHP').toUpperCase()
  const to = (toCurrency || 'PHP').toUpperCase()
  if (from === to) return num

  const fromRate = rates[from] || DEFAULT_USD_RATES[from] || 1
  const toRate = rates[to] || DEFAULT_USD_RATES[to] || 1
  const inUsd = num / fromRate
  return inUsd * toRate
}

export function getPreferredDisplayCurrency(fallback = 'PHP') {
  return localStorage.getItem(DISPLAY_CUR_KEY) || fallback
}

export function setPreferredDisplayCurrency(cur) {
  localStorage.setItem(DISPLAY_CUR_KEY, cur)
}

export function getRenewalReminderDays() {
  const val = parseInt(localStorage.getItem(REMINDER_DAYS_KEY) || '3', 10)
  return [1, 3, 7].includes(val) ? val : 3
}

export function setRenewalReminderDays(days) {
  localStorage.setItem(REMINDER_DAYS_KEY, String(days))
}
