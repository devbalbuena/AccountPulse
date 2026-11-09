import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useNow } from '@/context/TimeContext'
import { evaluateAccountStatus, formatDuration } from '@/lib/durationUtils'
import { resolveUnifiedPlatform, UnifiedPlatformIcon } from '@/lib/platformCategories'
import { computeRotationAnalytics } from '@/lib/rotationAnalytics'
import {
  Calendar,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  Check,
  Clock,
  History,
  RotateCcw,
} from 'lucide-react'

// ─── Proportional Monthly Spend Bar Chart ───
function MonthlySpendBarChart({ data, currency, avgMonthly }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const maxVal = Math.max(...data.map(d => d.total), 1)

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Monthly Spend Trend
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            6-month historical &amp; active recurring cost
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-muted-foreground">6-Mo Average: </span>
          <span className="text-xs font-bold text-foreground tabular-nums">
            {currency} {avgMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Chart Bars */}
      <div className="relative pt-6">
        <div className="grid grid-cols-7 gap-3 items-end h-36 px-2 border-b border-border">
          {data.map((item, idx) => {
            const pct = maxVal > 0 ? (item.total / maxVal) * 100 : 0
            const isHovered = hoveredIdx === idx
            const isCurrent = item.isCurrent

            return (
              <div
                key={item.label}
                className="relative flex flex-col items-center gap-2 h-full justify-end group cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-10 z-20 px-2.5 py-1 rounded-md border border-border bg-popover text-popover-foreground text-[11px] font-semibold shadow-md whitespace-nowrap tabular-nums pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                    <span>{item.label}: </span>
                    <span className="text-primary font-bold">
                      {currency} {item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <span className="text-[10px] text-muted-foreground font-mono tabular-nums opacity-70 group-hover:opacity-100">
                  {item.total > 1000 ? `${(item.total / 1000).toFixed(1)}k` : item.total > 0 ? item.total.toFixed(0) : '0'}
                </span>

                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    isCurrent
                      ? 'bg-primary shadow-xs'
                      : item.total > 0
                        ? 'bg-primary/25 hover:bg-primary/40 border border-primary/30'
                        : 'bg-muted/60'
                  }`}
                  style={{ height: `${Math.max(6, pct)}%` }}
                />
              </div>
            )
          })}
        </div>

        {/* X-axis labels */}
        <div className="grid grid-cols-7 gap-3 text-center text-xs text-muted-foreground pt-2.5 px-2">
          {data.map(item => (
            <span
              key={item.label}
              className={item.isCurrent ? 'font-bold text-foreground' : 'font-medium'}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Reports() {
  const { user } = useAuth()
  const now = useNow()

  const [data, setData] = useState({
    subs: [],
    accounts: [],
    timers: [],
    notifications: [],
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
        supabase.from('accounts').select('*, token_timers(*)').is('deleted_at', null).eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('token_timers').select('*'),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      ])

      if (subsRes.error) throw subsRes.error
      if (accsRes.error) throw accsRes.error
      if (timersRes.error) throw timersRes.error
      if (notifsRes.error) throw notifsRes.error

      setData({
        subs: subsRes.data || [],
        accounts: accsRes.data || [],
        timers: timersRes.data || [],
        notifications: notifsRes.data || [],
      })
    } catch (err) {
      console.error('Fetch error in reports:', err)
      setError('Failed to load reports. Please try again.')
    } finally {
      setLoading(false)
      setTimeout(() => setIsLoaded(true), 60)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
        <p className="text-sm font-semibold text-foreground">{error}</p>
        <button
          type="button"
          onClick={fetchData}
          className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    )
  }

  const { subs, accounts, timers, notifications } = data

  // Financial calculations
  const activeSubs = subs.filter(s => !s.paused_at)
  const totalMonthlySpend = activeSubs.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)
  const primaryCurrency = activeSubs[0]?.currency || subs[0]?.currency || 'PHP'
  const annualizedSpend = totalMonthlySpend * 12
  const dailyBurn = (totalMonthlySpend * 12) / 365

  // AI efficiency calculation: Dev Tools/AI category spend across AI accounts
  const aiSpend = activeSubs
    .filter(s => (s.category || '').toLowerCase().includes('dev') || (s.category || '').toLowerCase().includes('ai'))
    .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)
  const aiAccountsCount = accounts.filter(a => {
    const p = (a.platform || '').toLowerCase()
    return p.includes('antigravity') || p.includes('claude') || p.includes('gpt') || p.includes('gemini') || p.includes('cursor') || p.includes('windsurf')
  }).length || accounts.length || 1
  const spendPerAccount = (aiSpend || totalMonthlySpend) / aiAccountsCount

  // Fleet capacity calculations
  let totalModelGroups = 0
  let readyModelGroups = 0
  let cooldownModelGroups = 0

  const fleetPlatformMap = new Map()

  accounts.forEach(acc => {
    const unified = resolveUnifiedPlatform(acc.platform, acc.type, accounts, acc.icon_url)
    const st = evaluateAccountStatus(acc, now)
    const groups = st.groups || []

    groups.forEach(g => {
      totalModelGroups++
      if (g.isReady) readyModelGroups++
      else cooldownModelGroups++

      const mapKey = `${unified.key}:::${g.groupName}`
      const existing = fleetPlatformMap.get(mapKey)
      if (existing) {
        existing.totalAccounts++
        if (g.isReady) existing.readyAccounts++
      } else {
        fleetPlatformMap.set(mapKey, {
          unified,
          groupName: g.groupName,
          totalAccounts: 1,
          readyAccounts: g.isReady ? 1 : 0,
        })
      }
    })
  })

  const fleetMatrix = Array.from(fleetPlatformMap.values())
  const rotationAnalytics = computeRotationAnalytics(accounts, notifications)

  // Category breakdown with clean colors
  const CATEGORY_COLORS = {
    'Dev Tools': '#8b5cf6',
    'Entertainment': '#10b981',
    'Productivity': '#3b82f6',
    'Storage': '#06b6d4',
    'Design': '#f97316',
    'Security': '#ef4444',
    'Finance': '#14b8a6',
    'Other': '#64748b',
    'Uncategorized': '#94a3b8',
  }

  const categorySpendMap = {}
  activeSubs.forEach(s => {
    const c = s.category || 'Uncategorized'
    categorySpendMap[c] = (categorySpendMap[c] || 0) + parseFloat(s.amount || 0)
  })

  const categoryList = Object.entries(categorySpendMap)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: totalMonthlySpend > 0 ? (amount / totalMonthlySpend) * 100 : 0,
      color: CATEGORY_COLORS[name] || '#2563eb',
    }))
    .sort((a, b) => b.amount - a.amount)

  // 6-Month Monthly Spend Projection
  const monthlyProjection = (() => {
    const months = []
    const nowDate = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString('en-US', { month: 'short' }),
      })
    }
    return months.map(({ year, month, label }) => {
      const isCurrent = year === nowDate.getFullYear() && month === nowDate.getMonth()
      let total = 0
      subs.forEach(s => {
        const created = s.created_at ? new Date(s.created_at) : null
        if (created && (created.getFullYear() > year || (created.getFullYear() === year && created.getMonth() > month))) return
        total += parseFloat(s.amount || 0)
      })
      return { label, total, isCurrent }
    })
  })()

  const avgMonthly = monthlyProjection.reduce((a, b) => a + b.total, 0) / (monthlyProjection.length || 1)

  return (
    <div className="flex flex-col h-full min-h-0 max-w-7xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Reports &amp; Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Annualized run rates, category cost allocation, and AI quota fleet capacity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/subscriptions"
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted shadow-xs transition-colors flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Subscriptions</span>
          </Link>
          <Link
            to="/accounts"
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Accounts</span>
          </Link>
        </div>
      </div>

      <div
        className={`transition-all duration-300 space-y-5 flex-1 min-h-0 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* ── 3 Non-Redundant Analytical KPI Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Annualized Run Rate */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Annualized Run Rate
              </span>
              <span className="p-1 rounded-md bg-primary/10 text-primary">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {primaryCurrency} {annualizedSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-muted-foreground">/ yr</span>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Daily Burn Rate:</span>
              <strong className="text-foreground tabular-nums">
                {primaryCurrency} {dailyBurn.toFixed(2)} / day
              </strong>
            </div>
          </div>

          {/* Card 2: AI Fleet Cost Efficiency */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                AI Cost Efficiency
              </span>
              <span className="p-1 rounded-md bg-purple-500/10 text-purple-600">
                <Cpu className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {primaryCurrency} {spendPerAccount.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">/ AI account</span>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Dev Tools Spend:</span>
              <strong className="text-foreground tabular-nums">
                {primaryCurrency} {aiSpend.toFixed(2)} across {aiAccountsCount} accounts
              </strong>
            </div>
          </div>

          {/* Card 3: Fleet Timer Capacity */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fleet Timer Capacity
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums"
                style={{
                  background: 'var(--ready-bg)',
                  color: 'var(--ready-text)',
                  borderColor: 'var(--ready-border)',
                }}
              >
                {readyModelGroups} of {totalModelGroups} Ready
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {totalModelGroups}
              </span>
              <span className="text-xs text-muted-foreground">model groups across {accounts.length} accounts</span>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Readiness:</span>
              <strong className="text-foreground tabular-nums">
                {totalModelGroups > 0 ? Math.round((readyModelGroups / totalModelGroups) * 100) : 0}% fleet ready
              </strong>
            </div>
          </div>
        </div>

        {/* ── Middle Row: Monthly Spend Bar Chart + Category Cost Allocation ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Monthly Spending Trend Bar Chart */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 shadow-xs">
            <MonthlySpendBarChart
              data={monthlyProjection}
              currency={primaryCurrency}
              avgMonthly={avgMonthly}
            />
          </div>

          {/* Category Cost Allocation */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Spend by Category
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Share of monthly recurring cost</p>
            </div>

            <div className="my-3 space-y-3.5">
              {categoryList.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No subscription spend data
                </div>
              ) : (
                categoryList.map(cat => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 truncate pr-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="font-bold text-foreground tabular-nums shrink-0">
                        {primaryCurrency} {cat.amount.toFixed(2)} &bull; {cat.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${cat.pct}%`, background: cat.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Active Spend:</span>
              <strong className="text-foreground tabular-nums">
                {primaryCurrency} {totalMonthlySpend.toFixed(2)} / mo
              </strong>
            </div>
          </div>
        </div>

        {/* ── Bottom Section: AI Quota Fleet Capacity Matrix ── */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                AI Quota Fleet Capacity Matrix
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Aggregated quota readiness by Unified Platform and Model Group
              </p>
            </div>
            <Link to="/accounts" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              <span>Manage Accounts</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {fleetMatrix.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No AI quota timers configured in your fleet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-4">Unified AI Platform</th>
                    <th className="py-2.5 px-4">Model Group</th>
                    <th className="py-2.5 px-4">Tracked Accounts</th>
                    <th className="py-2.5 px-4">Ready Now</th>
                    <th className="py-2.5 px-4">Fleet Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fleetMatrix.map(item => {
                    const availPct = Math.round((item.readyAccounts / item.totalAccounts) * 100)
                    return (
                      <tr key={`${item.unified.key}-${item.groupName}`} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <UnifiedPlatformIcon
                              platform={item.unified.name}
                              type={item.unified.category}
                              allAccounts={accounts}
                              iconUrl={item.unified.iconUrl}
                              size="sm"
                            />
                            <span>{item.unified.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-foreground whitespace-nowrap">
                          {item.groupName}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground tabular-nums whitespace-nowrap">
                          {item.totalAccounts} {item.totalAccounts === 1 ? 'account' : 'accounts'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                          {item.readyAccounts} ready
                        </td>
                        <td className="py-2.5 px-4 w-52 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  availPct === 100 ? 'bg-emerald-500' : availPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${availPct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums text-foreground w-9 text-right">
                              {availPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Quota Rotation History & Account Utilization Analytics ── */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-card">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-primary" />
                <span>Quota Rotation History &amp; Account Utilization</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Tracks how often each account is drained and rotated vs. sitting idle in your fleet
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold tabular-nums">
                {rotationAnalytics.totalRotations24h} today &bull; {rotationAnalytics.totalRotations7d} this week
              </span>
              {rotationAnalytics.idleAccountsCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold tabular-nums">
                  {rotationAnalytics.idleAccountsCount} idle
                </span>
              )}
            </div>
          </div>

          {rotationAnalytics.accountStats.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Add accounts to track quota rotation frequency
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-4">Account Email</th>
                    <th className="py-2.5 px-4">Platform</th>
                    <th className="py-2.5 px-4">24h Rotations</th>
                    <th className="py-2.5 px-4">7-Day Rotations</th>
                    <th className="py-2.5 px-4">Last Rotated</th>
                    <th className="py-2.5 px-4">Utilization Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rotationAnalytics.accountStats.map(stat => {
                    const isHeavy = stat.count7d >= 3
                    const isIdle = stat.count7d === 0
                    return (
                      <tr key={stat.account.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                          {stat.email}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <UnifiedPlatformIcon
                              platform={stat.platform}
                              type={stat.account.type}
                              allAccounts={accounts}
                              iconUrl={stat.account.icon_url}
                              size="sm"
                            />
                            <span className="font-semibold text-foreground">{stat.platform}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-bold tabular-nums text-foreground whitespace-nowrap">
                          {stat.count24h}x
                        </td>
                        <td className="py-2.5 px-4 font-bold tabular-nums text-foreground whitespace-nowrap">
                          {stat.count7d}x
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                          {stat.lastRotatedMs ? timeAgo(new Date(stat.lastRotatedMs).toISOString()) : 'Never drained'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {isHeavy ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                              Heavily Utilized
                            </span>
                          ) : isIdle ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Idle — Ready to Use
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Balanced Rotation
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Recent Token Refresh Activity ── */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Recent Token Activity Log
              </h3>
            </div>
            <span className="text-[11px] text-muted-foreground">Live real-time feed</span>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No recent token activity recorded</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {notifications.slice(0, 6).map(n => {
                const matchingAcc = accounts.find(a => n.message.includes(a.email))
                return (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-lg border border-border/60 bg-muted/30 flex items-start gap-2.5 text-xs"
                  >
                    <UnifiedPlatformIcon
                      platform={matchingAcc?.platform || 'AI'}
                      type={matchingAcc?.type || ''}
                      allAccounts={accounts}
                      iconUrl={matchingAcc?.icon_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
