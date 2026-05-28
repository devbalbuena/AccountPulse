import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import StatCard from '@/components/StatCard'
import CountdownTimer from '@/components/CountdownTimer'
import { Layers, Clock, Receipt, Calendar } from 'lucide-react'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

export default function Dashboard() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    async function load() {
      const [{ data: acc }, { data: subs }] = await Promise.all([
        supabase.from('accounts').select('*, token_timers(*)').is('deleted_at', null).eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('subscriptions').select('*').is('deleted_at', null).eq('user_id', user.id).order('next_billing_date', { ascending: true }).limit(5)
      ])
      setAccounts(acc || [])
      setSubscriptions(subs || [])
      setLoading(false)
    }
    load()
  }, [user])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const expiringIn24h = accounts.filter(a => {
    if (!a.token_timers?.[0]?.next_due_at) return false
    return (new Date(a.token_timers[0].next_due_at) - new Date()) <= 86400000
  }).length

  const dueThisMonth = subscriptions.filter(s => {
    const d = daysUntil(s.next_billing_date)
    return d !== null && d >= 0 && d <= 30
  }).length

  const nextBill = subscriptions[0] || null

  if (loading) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Welcome back, {user?.email}</p>
        </div>

        {/* Unified "+ New" dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <span>+ New</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
              <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-20">
              <Link to="/accounts/new" onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <span className="text-indigo-500">◎</span> Account
              </Link>
              <Link to="/subscriptions/new" onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800">
                <span className="text-emerald-500">◈</span> Subscription
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Accounts" value={accounts.length} icon={<Layers className="h-5 w-5 text-muted-foreground stroke-[1.75]" />} />
        <StatCard title="Expiring in 24h" value={expiringIn24h} icon={<Clock className="h-5 w-5 text-muted-foreground stroke-[1.75]" />} pulse={expiringIn24h > 0} />
        <StatCard title="Bills This Month" value={dueThisMonth} icon={<Receipt className="h-5 w-5 text-muted-foreground stroke-[1.75]" />} />
        <StatCard
          title="Next Bill"
          value={nextBill ? nextBill.service_name : '—'}
          subtitle={nextBill ? formatDate(nextBill.next_billing_date) : 'No upcoming bills'}
          icon={<Calendar className="h-5 w-5 text-muted-foreground stroke-[1.75]" />}
        />
      </div>

      {/* Two column lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Accounts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accounts</h3>
            <Link to="/accounts" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">View all →</Link>
          </div>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Layers className="h-12 w-12 text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground">No accounts yet</p>
              <Link to="/accounts/new" className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Add one →</Link>
            </div>
          ) : (
            <ul>
              {accounts.map(acc => (
                <li key={acc.id} className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{acc.email}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span className="inline-block bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium px-2 py-0.5 rounded-full">{acc.platform}</span>
                      {acc.type}
                    </p>
                  </div>
                  <CountdownTimer nextDueAt={acc.token_timers?.[0]?.next_due_at} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Subscriptions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upcoming Bills</h3>
            <Link to="/subscriptions" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">View all →</Link>
          </div>
          {subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground">No subscriptions yet</p>
              <Link to="/subscriptions/new" className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Add one →</Link>
            </div>
          ) : (
            <ul>
              {subscriptions.map(sub => {
                const days = daysUntil(sub.next_billing_date)
                const urgent = days !== null && days <= 3
                const daysColor = days !== null && days < 0 ? 'text-red-500' : days <= 3 ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'
                const daysLabel = days === null ? '' : days < 0 ? 'Overdue' : days === 0 ? 'Due today' : `${days}d left`
                return (
                  <li key={sub.id} className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                    <div className="flex items-center gap-2">
                      {urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />}
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{sub.service_name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(sub.next_billing_date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{sub.currency} {parseFloat(sub.amount).toFixed(2)}</p>
                      <p className={`text-xs mt-0.5 font-medium ${daysColor}`}>{daysLabel}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
