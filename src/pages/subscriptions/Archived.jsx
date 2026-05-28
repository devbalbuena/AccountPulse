import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const thCls = "px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800"
const tdCls = "px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 align-middle"

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SubscriptionsArchived() {
  const { user } = useAuth()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('subscriptions').select('*')
      .not('deleted_at', 'is', null).eq('user_id', user.id).order('deleted_at', { ascending: false })
    setSubs(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleRestore(id) {
    await supabase.from('subscriptions').update({ deleted_at: null }).eq('id', id)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this subscription? This cannot be undone.')) return
    await supabase.from('subscriptions').delete().eq('id', id)
    load()
  }

  if (loading) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>

  return (
    <div>
      <div className="mb-6">
        <Link to="/subscriptions" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Back to Subscriptions</Link>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Archived Subscriptions</h2>
      </div>

      {subs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 px-4 text-center shadow-sm dark:shadow-none">
          <div className="text-5xl mb-4 opacity-10 select-none">🗂</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No archived subscriptions</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Service</th>
                <th className={thCls}>Amount</th>
                <th className={thCls}>Billing Day</th>
                <th className={thCls}>Archived</th>
                <th className={`${thCls} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(sub => (
                <tr key={sub.id} className="opacity-70 hover:opacity-100 transition-opacity">
                  <td className={`${tdCls} font-medium text-slate-600 dark:text-slate-400`}>{sub.service_name}</td>
                  <td className={`${tdCls} text-slate-500 dark:text-slate-400`}>{sub.currency} {parseFloat(sub.amount).toFixed(2)}</td>
                  <td className={`${tdCls} text-slate-500 dark:text-slate-400`}>Day {sub.billing_day}</td>
                  <td className={`${tdCls} text-slate-400 dark:text-slate-500 text-xs`}>{formatDate(sub.deleted_at)}</td>
                  <td className={`${tdCls} text-right`}>
                    <div className="flex items-center justify-end gap-4">
                      <button onClick={() => handleRestore(sub.id)} className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">Restore</button>
                      <button onClick={() => handleDelete(sub.id)} className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
