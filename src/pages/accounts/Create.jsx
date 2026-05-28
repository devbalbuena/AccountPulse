import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
const labelCls = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"

export default function AccountCreate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', platform: '', type: '', notes: '', interval_days: '', interval_hours: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, email: form.email, platform: form.platform, type: form.type, notes: form.notes || null })
      .select().single()

    if (accErr) { setError(accErr.message); setLoading(false); return }

    const days = parseInt(form.interval_days) || 0
    const hours = parseInt(form.interval_hours) || 0
    const totalHours = (days * 24) + hours

    if (totalHours > 0) {
      const nextDue = new Date(Date.now() + totalHours * 3600000)
      await supabase.from('token_timers').insert({ account_id: account.id, interval_hours: totalHours, next_due_at: nextDue.toISOString() })
    }

    navigate('/accounts')
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link to="/accounts" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Back to Accounts</Link>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Add Account</h2>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-7 shadow-sm dark:shadow-none">
        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" required className={inputCls} placeholder="account@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Platform</label>
            <input type="text" required className={inputCls} placeholder="e.g. Facebook, Gmail, Netflix"
              value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <input type="text" required className={inputCls} placeholder="e.g. Social, Email, Streaming"
              value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Notes <span className="text-slate-400">(optional)</span></label>
            <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Any notes…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-1">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">Token Refresh Interval <span className="font-normal normal-case text-slate-400">(optional)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Days</label>
                <input type="number" min="0" className={inputCls} placeholder="0"
                  value={form.interval_days} onChange={e => setForm({ ...form, interval_days: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Hours</label>
                <input type="number" min="0" max="23" className={inputCls} placeholder="0"
                  value={form.interval_hours} onChange={e => setForm({ ...form, interval_hours: e.target.value })} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2">
            {loading ? 'Saving…' : 'Save Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
