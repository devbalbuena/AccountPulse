import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Calendar, CreditCard, Activity, AlertTriangle, RotateCw, RefreshCw, RefreshCcw } from 'lucide-react'

// Utilities
const PALETTE = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6']
function getPlatformColor(name) {
  if (!name) return PALETTE[0]
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return PALETTE[sum % PALETTE.length]
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function computeTimerStatus(timer) {
  if (!timer) return { label: 'No Timer', color: '#94a3b8' }
  const now = new Date()
  const due = new Date(timer.next_due_at)
  if (now > due) return { label: 'Expired', color: '#ef4444' }
  const hoursLeft = (due - now) / 3600000
  if (hoursLeft <= 24) return { label: 'Expiring', color: '#f59e0b' }
  return { label: 'Active', color: '#22c55e' }
}

function computeTimeLeft(timer) {
  if (!timer) return ''
  const now = new Date()
  const due = new Date(timer.next_due_at)
  if (now > due) return '0s'
  const diff = due - now
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function Reports() {
  const { user } = useAuth()

  const [data, setData] = useState({
    subs: [],
    accounts: [],
    timers: [],
    notifications: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const [subsRes, accsRes, timersRes, notifsRes] = await Promise.all([
        supabase.from('subscriptions').select('*').is('deleted_at', null).eq('user_id', user.id),
        supabase.from('accounts').select('*').is('deleted_at', null).eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('token_timers').select('*'),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
      ])

      if (subsRes.error) throw subsRes.error
      if (accsRes.error) throw accsRes.error
      if (timersRes.error) throw timersRes.error
      if (notifsRes.error) throw notifsRes.error

      setData({
        subs: subsRes.data || [],
        accounts: accsRes.data || [],
        timers: timersRes.data || [],
        notifications: notifsRes.data || []
      })
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
      setTimeout(() => setIsLoaded(true), 100)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
        <p className="text-[#0d0d1a] dark:text-slate-200 font-medium">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-[#7c3aed] text-white rounded-lg font-medium hover:opacity-90">
          Try Again
        </button>
      </div>
    )
  }

  // Calculate Metrics
  const { subs, accounts, timers, notifications } = data

  // 1. Total Spend
  const totalSpend = subs.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)
  const currencies = [...new Set(subs.map(s => s.currency))]
  const displayCurrency = currencies.length > 1 ? 'Mixed' : (currencies[0] || 'PHP')

  // 2. Upcoming Renewals
  const upcomingCount = subs.filter(s => {
    const d = daysUntil(s.next_billing_date)
    return d !== null && d <= 7 && d >= 0
  }).length

  // 3. Category Data (Group by Service Name)
  const categoryMap = {}
  subs.forEach(s => {
    const name = s.service_name
    categoryMap[name] = (categoryMap[name] || 0) + parseFloat(s.amount || 0)
  })

  const categoryData = Object.keys(categoryMap)
    .map(name => ({
      name,
      amount: categoryMap[name],
      pct: totalSpend > 0 ? (categoryMap[name] / totalSpend) * 100 : 0,
      color: getPlatformColor(name)
    }))
    .sort((a, b) => b.amount - a.amount)

  // Generate conic gradient string
  let conicString = ''
  let currentPct = 0
  categoryData.forEach((cat, idx) => {
    const endPct = currentPct + cat.pct
    conicString += `${cat.color} ${currentPct}% ${endPct}%${idx < categoryData.length - 1 ? ', ' : ''}`
    currentPct = endPct
  })
  if (!conicString) conicString = '#e2e4f0 0% 100%' // Empty state

  // 4. Top Expenses
  const topExpenses = [...subs].sort((a, b) => parseFloat(b.amount || 0) - parseFloat(a.amount || 0)).slice(0, 3)

  // Skeleton Loader Component
  const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`} />
  )

  return (
    <div className="pb-8 min-h-full -m-6 p-6 transition-colors duration-300 bg-[#f0f2ff] dark:bg-transparent">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0d0d1a] dark:text-slate-100">Reports & Analytics</h2>
          <p className="text-sm mt-1 text-[#5a5a7a] dark:text-slate-400">Overview of your accounts and spending trends.</p>
        </div>
        <div className="shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border bg-[#ffffff] dark:bg-slate-800/50 border-[#e2e4f0] dark:border-slate-700 text-[#0d0d1a] dark:text-slate-300 hover:bg-[#f5f5ff] dark:hover:bg-slate-800 transition-colors">
            <Calendar className="w-4 h-4 text-[#7c3aed] dark:text-current" />
            Last 30 Days
          </button>
        </div>
      </div>

      <div className={`transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

        {/* ── Top Row: KPI Metrics ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          {/* Card 1: Total Spend */}
          <div className="p-5 rounded-2xl border bg-[#ffffff] dark:bg-slate-800/20 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(124,58,237,0.08)] dark:shadow-none border-l-[3px] border-l-[#7c3aed] overflow-hidden relative">
            <p className="text-sm font-medium text-[#5a5a7a] dark:text-slate-400 mb-1">Total Monthly Spend</p>
            {loading ? <Skeleton className="h-8 w-32 mb-2" /> : (
              <h3 className="text-2xl font-bold text-[#0d0d1a] dark:text-slate-100 tracking-tight">
                {displayCurrency} {totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            )}
          </div>

          {/* Card 2: Active Subs */}
          <div className="p-5 rounded-2xl border bg-[#ffffff] dark:bg-slate-800/20 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(124,58,237,0.08)] dark:shadow-none border-l-[3px] border-l-[#10b981] overflow-hidden relative">
            <p className="text-sm font-medium text-[#5a5a7a] dark:text-slate-400 mb-1">Active Subscriptions</p>
            {loading ? <Skeleton className="h-8 w-16 mb-2 mt-1" /> : (
              <>
                <h3 className="text-2xl font-bold text-[#0d0d1a] dark:text-slate-100 tracking-tight">{subs.length}</h3>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#10b981]">
                  {subs.length} subscriptions tracked
                </div>
              </>
            )}
          </div>

          {/* Card 3: Tracked Accounts */}
          <div className="p-5 rounded-2xl border bg-[#ffffff] dark:bg-slate-800/20 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(124,58,237,0.08)] dark:shadow-none border-l-[3px] border-l-[#06b6d4] overflow-hidden relative">
            <p className="text-sm font-medium text-[#5a5a7a] dark:text-slate-400 mb-1">Tracked Accounts</p>
            {loading ? <Skeleton className="h-8 w-16 mb-2 mt-1" /> : (
              <>
                <h3 className="text-2xl font-bold text-[#0d0d1a] dark:text-slate-100 tracking-tight">{accounts.length}</h3>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#06b6d4]">
                  {accounts.length} active accounts
                </div>
              </>
            )}
          </div>

          {/* Card 4: Upcoming Renewals */}
          <div className="p-5 rounded-2xl border bg-[#ffffff] dark:bg-slate-800/20 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(124,58,237,0.08)] dark:shadow-none border-l-[3px] border-l-[#f59e0b] overflow-hidden relative">
            <p className="text-sm font-medium text-[#5a5a7a] dark:text-slate-400 mb-1">Upcoming Renewals (7 Days)</p>
            {loading ? <Skeleton className="h-8 w-16 mb-2 mt-1" /> : (
              <>
                <h3 className="text-2xl font-bold text-[#0d0d1a] dark:text-slate-100 tracking-tight">{upcomingCount}</h3>
                {upcomingCount > 0 ? (
                  <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#f59e0b]">
                    <AlertTriangle className="w-3.5 h-3.5" /> Action needed soon
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#10b981]">
                    None this week
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* ── Middle Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Top Expenses (Left 2/3) */}
          <div className="lg:col-span-2 p-6 rounded-2xl border bg-[#ffffff] dark:bg-slate-900/50 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-none flex flex-col">
            <h3 className="text-base font-bold text-[#0d0d1a] dark:text-slate-200 mb-5">Top Expenses</h3>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : topExpenses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <CreditCard className="w-10 h-10 mb-3 text-[#e2e4f0] dark:text-slate-700" />
                <p className="text-[#5a5a7a] dark:text-slate-400 text-sm">No subscriptions added yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topExpenses.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-[#f8f7ff] dark:bg-slate-800/30 border-[#f0f0f8] dark:border-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {item.icon_url ? (
                        <img src={item.icon_url} alt={item.service_name} className="w-10 h-10 rounded-lg object-cover shadow-sm border border-[#f0f0f8] dark:border-slate-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: getPlatformColor(item.service_name) }}>
                          {item.service_name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-[#0d0d1a] dark:text-slate-200">{item.service_name}</p>
                        <p className="text-[11px] text-[#5a5a7a] dark:text-slate-400 font-medium mt-0.5">Rank #{idx + 1}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#7c3aed] dark:text-slate-200">{item.currency} {parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-[11px] text-[#5a5a7a] dark:text-slate-500">/ month</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Donut Chart (Right 1/3) */}
          <div className="p-6 rounded-2xl border bg-[#ffffff] dark:bg-slate-900/50 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-none flex flex-col items-center justify-center min-h-[300px]">
            <h3 className="text-base font-bold text-[#0d0d1a] dark:text-slate-200 w-full mb-6 text-left">Spend by Category</h3>

            {loading ? (
              <div className="flex flex-col items-center w-full">
                <Skeleton className="w-40 h-40 rounded-full mb-8" />
                <div className="w-full space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
              </div>
            ) : categoryData.length === 0 ? (
              <p className="text-[#5a5a7a] dark:text-slate-400 text-sm py-10">No spend data</p>
            ) : (
              <>
                <div className="relative w-40 h-40 mb-8">
                  {/* Conic Gradient Donut */}
                  <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${conicString})` }} />
                  {/* Inner cutout - Matches card bg in light/dark mode using specific classes */}
                  <div className="absolute inset-[14px] bg-[#ffffff] dark:bg-slate-900 rounded-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold text-[#5a5a7a] dark:text-slate-500 uppercase tracking-widest">Total</p>
                      <p className="text-sm font-bold text-[#0d0d1a] dark:text-slate-200 leading-tight">
                        {displayCurrency} {totalSpend > 1000 ? `${(totalSpend / 1000).toFixed(1)}k` : totalSpend.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-3 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                  {categoryData.map(cat => (
                    <div key={cat.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-[#0d0d1a] dark:text-slate-300 truncate">{cat.name}</span>
                      </div>
                      <span className="font-semibold text-[#5a5a7a] dark:text-slate-200 shrink-0">{cat.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Token Activity */}
          <div className="p-6 rounded-2xl border bg-[#ffffff] dark:bg-slate-900/50 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-none">
            <h3 className="text-base font-bold text-[#0d0d1a] dark:text-slate-200 mb-5">Recent Token Activity</h3>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <p className="text-[#5a5a7a] dark:text-slate-400 text-sm">No recent token activity.</p>
              </div>
            ) : (
              <div className="space-y-0 border border-[#f0f0f8] dark:border-slate-800/50 rounded-xl overflow-hidden">
                {notifications.map((n, i) => {
                  const platName = n.message.split(' ')[0]
                  return (
                    <div key={n.id} className={`flex items-start gap-3 p-3 transition-colors hover:bg-[#f8f7ff] dark:hover:bg-slate-800/30 ${i !== notifications.length - 1 ? 'border-b border-[#f0f0f8] dark:border-slate-800/50' : ''}`}>
                      <div className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-sm mt-0.5" style={{ background: getPlatformColor(platName) }}>
                        {platName[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0d0d1a] dark:text-slate-200 leading-snug">{n.message}</p>
                        <p className="text-xs text-[#5a5a7a] dark:text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Accounts Overview */}
          <div className="p-6 rounded-2xl border bg-[#ffffff] dark:bg-slate-900/50 border-[#e2e4f0] dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-none flex flex-col max-h-[350px]">
            <h3 className="text-base font-bold text-[#0d0d1a] dark:text-slate-200 mb-5 shrink-0">Accounts Overview</h3>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <p className="text-[#5a5a7a] dark:text-slate-400 text-sm">No active accounts.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 border border-[#f0f0f8] dark:border-slate-800/50 rounded-xl bg-[#ffffff] dark:bg-transparent">
                {accounts.map((acc, i) => {
                  const timer = timers.find(t => t.account_id === acc.id)
                  const status = computeTimerStatus(timer)
                  const timeLeft = computeTimeLeft(timer)

                  return (
                    <div key={acc.id} className={`flex items-center justify-between p-3 transition-colors hover:bg-[#f8f7ff] dark:hover:bg-slate-800/30 ${i !== accounts.length - 1 ? 'border-b border-[#f0f0f8] dark:border-slate-800/50' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <div className="px-2 py-1 rounded bg-[#ede9fe] dark:bg-slate-800 text-[#7c3aed] dark:text-white text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-sm border border-[#7c3aed]/10 dark:border-slate-700">
                          {acc.platform}
                        </div>
                        <p className="text-sm font-medium text-[#0d0d1a] dark:text-slate-200 truncate">{acc.email}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {timer && <span className="text-xs font-semibold" style={{ color: status.color }}>{timeLeft}</span>}
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: status.color }} title={status.label} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
