import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const thCls = "px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800"
const tdCls = "px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 align-middle"

export default function AccountsArchived() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('accounts').select('*, token_timers(*)')
      .not('deleted_at', 'is', null).eq('user_id', user.id).order('deleted_at', { ascending: false })
    setAccounts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleRestore(id) {
    await supabase.from('accounts').update({ deleted_at: null }).eq('id', id)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this account? This cannot be undone.')) return
    await supabase.from('token_timers').delete().eq('account_id', id)
    await supabase.from('accounts').delete().eq('id', id)
    load()
  }

  if (loading) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>

  return (
    <div>
      <div className="mb-6">
        <Link to="/accounts" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Back to Accounts</Link>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Archived Accounts</h2>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 px-4 text-center shadow-sm dark:shadow-none">
          <div className="text-5xl mb-4 opacity-10 select-none">🗂</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No archived accounts</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Email</th>
                <th className={thCls}>Platform</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Archived</th>
                <th className={`${thCls} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} className="opacity-70 hover:opacity-100 transition-opacity">
                  <td className={`${tdCls} font-medium text-slate-600 dark:text-slate-400`}>{acc.email}</td>
                  <td className={tdCls}>
                    <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {acc.platform}
                    </span>
                  </td>
                  <td className={`${tdCls} text-slate-500 dark:text-slate-400`}>{acc.type}</td>
                  <td className={`${tdCls} text-slate-400 dark:text-slate-500 text-xs`}>{new Date(acc.deleted_at).toLocaleDateString()}</td>
                  <td className={`${tdCls} text-right`}>
                    <div className="flex items-center justify-end gap-4">
                      <button onClick={() => handleRestore(acc.id)} className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">Restore</button>
                      <button onClick={() => handleDelete(acc.id)} className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline">Delete</button>
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
