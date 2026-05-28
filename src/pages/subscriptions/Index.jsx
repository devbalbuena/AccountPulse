import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import DaysUntilBadge from '@/components/DaysUntilBadge'
import { Search } from 'lucide-react'

const thCls = "px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800"
const tdCls = "px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 align-middle"

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SubscriptionsIndex() {
  const { user } = useAuth()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')

  async function load() {
    const { data } = await supabase
      .from('subscriptions').select('*')
      .is('deleted_at', null).eq('user_id', user.id)
      .order('next_billing_date', { ascending: true })
    setSubs(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleArchive(id) {
    if (!confirm('Archive this subscription?')) return
    await supabase.from('subscriptions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const totalMonthly = subs.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)

  if (loading) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>

  const filteredSubs = subs.filter(sub => {
    const matchesSearch = sub.service_name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Subscriptions</h2>
          {subs.length > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Total monthly: <span className="font-semibold text-foreground">PHP {totalMonthly.toFixed(2)}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/subscriptions/archived"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
            Archived
          </Link>
          <Link to="/subscriptions/new"
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors">
            + Add Subscription
          </Link>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 px-4 text-center shadow-sm dark:shadow-none">
          <div className="text-5xl mb-4 opacity-10 select-none">◈</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No subscriptions yet</p>
          <Link to="/subscriptions/new" className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Add your first subscription →</Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search by service..." 
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
              <option value="All">All Services</option>
            </select>
          </div>

          <div className="bg-card text-card-foreground rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Service</th>
                <th className={thCls}>Billing Day</th>
                <th className={thCls}>Next Bill</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Amount</th>
                <th className={thCls}>Notes</th>
                <th className={`${thCls} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.map(sub => {
                const days = daysUntil(sub.next_billing_date)
                const urgent = days !== null && days <= 3
                return (
                  <tr key={sub.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className={`${tdCls} font-medium text-slate-800 dark:text-slate-200`}>
                      <div className="flex items-center gap-2">
                        {urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />}
                        {sub.service_name}
                      </div>
                    </td>
                    <td className={`${tdCls} text-slate-500 dark:text-slate-400`}>Day {sub.billing_day}</td>
                    <td className={`${tdCls} text-slate-500 dark:text-slate-400`}>{formatDate(sub.next_billing_date)}</td>
                    <td className={tdCls}><DaysUntilBadge days={days} /></td>
                    <td className={`${tdCls} font-semibold text-emerald-600 dark:text-emerald-400`}>
                      {sub.currency} {parseFloat(sub.amount).toFixed(2)}
                    </td>
                    <td className={`${tdCls} text-slate-400 dark:text-slate-500 text-xs max-w-[160px] truncate`}>
                      {sub.notes || '—'}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <div className="flex items-center justify-end gap-4">
                        <Link to={`/subscriptions/${sub.id}/edit`}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Edit</Link>
                        <button onClick={() => handleArchive(sub.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors text-sm font-medium">Archive</button>
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
