import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { computeNextBillingDate } from '@/lib/subscriptionUtils'

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'JPY']

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
const labelCls = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"

export default function SubscriptionEdit() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ service_name: '', billing_day: '', amount: '', currency: 'PHP', notes: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('subscriptions').select('*').eq('id', id).eq('user_id', user.id).single()
      if (!data) { navigate('/subscriptions'); return }
      setForm({ service_name: data.service_name, billing_day: data.billing_day, amount: data.amount, currency: data.currency, notes: data.notes || '' })
      setFetching(false)
    }
    load()
  }, [id, user])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const day = parseInt(form.billing_day)
    if (isNaN(day) || day < 1 || day > 31) { setError('Billing day must be between 1 and 31.'); return }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { setError('Amount must be a positive number.'); return }
    setLoading(true)
    const { error: err } = await supabase.from('subscriptions').update({
      service_name: form.service_name, billing_day: day,
      next_billing_date: computeNextBillingDate(day),
      amount: parseFloat(form.amount), currency: form.currency, notes: form.notes || null
    }).eq('id', id)
    if (err) { setError(err.message); setLoading(false); return }
    navigate('/subscriptions')
  }

  const previewDay = parseInt(form.billing_day)
  const previewDate = (!isNaN(previewDay) && previewDay >= 1 && previewDay <= 31) ? computeNextBillingDate(previewDay) : null

  if (fetching) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link to="/subscriptions" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Back to Subscriptions</Link>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Edit Subscription</h2>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-7 shadow-sm dark:shadow-none">
        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Service Name</label>
            <input type="text" required className={inputCls} value={form.service_name} onChange={e => setForm({ ...form, service_name: e.target.value })} />
          </div>

          <div>
            <label className={labelCls}>Billing Day of Month</label>
            <input type="number" required min="1" max="31" className={inputCls} value={form.billing_day} onChange={e => setForm({ ...form, billing_day: e.target.value })} />
            {previewDate && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
                Next bill: {new Date(previewDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount</label>
              <input type="number" required min="0.01" step="0.01" className={inputCls} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select className={inputCls} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes <span className="text-slate-400">(optional)</span></label>
            <textarea className={`${inputCls} min-h-20 resize-y`} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
