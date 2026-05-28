import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import CountdownTimer from '@/components/CountdownTimer'
import { Search } from 'lucide-react'

const thCls = "px-4 py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase text-left bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800"
const tdCls = "px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 align-middle"

export default function AccountsIndex() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')

  async function load() {
    const { data } = await supabase
      .from('accounts').select('*, token_timers(*)')
      .is('deleted_at', null).eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setAccounts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleArchive(id) {
    if (!confirm('Archive this account?')) return
    await supabase.from('accounts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function handleMarkRefreshed(timerId, intervalHours) {
    const now = new Date()
    const nextDue = new Date(now.getTime() + intervalHours * 3600000)
    await supabase.from('token_timers').update({ last_refreshed_at: now.toISOString(), next_due_at: nextDue.toISOString() }).eq('id', timerId)
    load()
  }

  if (loading) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          acc.platform.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (filterType !== 'All') return acc.type === filterType
    return true
  })

  const types = ['All', ...new Set(accounts.map(a => a.type))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Accounts</h2>
        <div className="flex items-center gap-3">
          <Link to="/accounts/archived"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
            Archived
          </Link>
          <Link to="/accounts/new"
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors">
            + Add Account
          </Link>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 px-4 text-center shadow-sm dark:shadow-none">
          <div className="text-5xl mb-4 opacity-10 select-none">◎</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No accounts yet</p>
          <Link to="/accounts/new" className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Add your first account →</Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search by email or platform..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring" 
              />
            </div>
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full sm:w-auto bg-background border border-input text-sm rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {types.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
            </select>
          </div>
          
          <div className="bg-card text-card-foreground rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Email</th>
                <th className={thCls}>Platform</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Token Timer</th>
                <th className={thCls}>Interval</th>
                <th className={`${thCls} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map(acc => {
                const timer = acc.token_timers?.[0]
                return (
                  <tr key={acc.id} className="group hover:bg-muted/50 transition-colors">
                    <td className={`${tdCls} font-medium text-slate-800 dark:text-slate-200`}>{acc.email}</td>
                    <td className={tdCls}>
                      <span className="inline-block bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        {acc.platform}
                      </span>
                    </td>
                    <td className={`${tdCls} text-slate-500 dark:text-slate-400`}>{acc.type}</td>
                    <td className={tdCls}><CountdownTimer nextDueAt={timer?.next_due_at} /></td>
                    <td className={`${tdCls} text-slate-400 dark:text-slate-500 text-xs`}>
                      {timer ? `Every ${timer.interval_hours}h` : '—'}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <div className="flex items-center justify-end gap-4">
                        {timer && (
                          <button onClick={() => handleMarkRefreshed(timer.id, timer.interval_hours)}
                            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                            ✓ Refreshed
                          </button>
                        )}
                        <Link to={`/accounts/${acc.id}/edit`}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                          Edit
                        </Link>
                        <button onClick={() => handleArchive(acc.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors text-sm font-medium">
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
