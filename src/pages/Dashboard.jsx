import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import CountdownTimer from '@/components/CountdownTimer'
import AccountModal from '@/components/AccountModal'
import SubscriptionModal from '@/components/SubscriptionModal'
import { evaluateAccountStatus, formatDuration } from '@/lib/durationUtils'
import { useNow } from '@/context/TimeContext'
import { Layers, Clock, Receipt, Calendar, Plus, Bell, CheckCircle2, ArrowRight, Copy, Check } from 'lucide-react'
import { useToast } from '@/context/ToastContext'

/* ─── helpers ─── */
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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



/* ─── Token Health Bar ─── */
function TokenHealthBar({ accounts }) {
  const validAccounts = (accounts || []).filter(a => a.token_timers && a.token_timers.length > 0)
  const total = validAccounts.length
  
  if (total === 0) {
    return (
      <div className="mt-3">
        <div className="w-full h-1.5 rounded-full bg-muted" />
        <div className="flex gap-2 text-xs mt-2 text-muted-foreground">
          <span>No active timers</span>
        </div>
      </div>
    )
  }

  const now = Date.now()
  let ready = 0
  let cooldown = 0

  validAccounts.forEach(a => {
    const { isReady, hasTimers } = evaluateAccountStatus(a, now)
    if (hasTimers !== false) {
      if (isReady) ready++
      else cooldown++
    }
  })

  const rPct = total > 0 ? (ready / total) * 100 : 0
  const cPct = total > 0 ? (cooldown / total) * 100 : 0

  return (
    <div className="mt-3">
      <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-muted">
        {rPct > 0 && <div className="h-full bg-emerald-600 transition-all duration-300" style={{ width: `${rPct}%` }} />}
        {cPct > 0 && <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${cPct}%` }} />}
      </div>
      <div className="flex items-center gap-3 text-xs mt-2 font-medium">
        <span className="text-emerald-700 dark:text-emerald-400">✓ {ready} ready</span>
        <span className="text-amber-700 dark:text-amber-400">⏳ {cooldown} on cooldown</span>
      </div>
    </div>
  )
}

/* ─── Clean KPI Stat Card ─── */
function StatCard({ title, value, subtitle, icon, rawAccounts }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between transition-all hover:border-border/80 shadow-xs">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-2 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {title === 'Total Accounts' && (
        <TokenHealthBar accounts={rawAccounts || []} />
      )}
    </div>
  )
}

/* ─── Clean SVG Donut Chart ─── */
const CHART_COLORS = ['#2563eb', '#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed']

function DonutChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      <p>No account data</p>
    </div>
  )
  const total = data.reduce((s, d) => s + d.count, 0)
  const size = 110, cx = 55, cy = 55, r = 42, strokeW = 12
  let offset = 0
  const circ = 2 * Math.PI * r
  const slices = data.map((d, i) => {
    const pct = d.count / total
    const dash = pct * circ
    const slice = { ...d, dash, offset, color: CHART_COLORS[i % CHART_COLORS.length] }
    offset += dash
    return slice
  })
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeW} />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={strokeW}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-(s.offset - circ / 4)}
            strokeLinecap="butt" />
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" className="text-sm font-bold fill-foreground">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="truncate text-foreground font-medium">{s.platform}</span>
            <span className="ml-auto text-muted-foreground font-semibold tabular-nums pl-2 shrink-0">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Panel Container ─── */
function Panel({ title, action, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-border bg-card flex flex-col overflow-hidden shadow-xs ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0 bg-card">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [totalAccounts, setTotalAccounts] = useState(0)
  const [subscriptions, setSubscriptions] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(
    sessionStorage.getItem('dashboard_banner_dismissed') === 'true'
  )
  
  const lastLogin = localStorage.getItem('accountpulse_last_login')
  const lastBrowser = localStorage.getItem('accountpulse_last_browser')
  
  const now = useNow()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    const [{ data: acc }, { data: subs }, { count: accCount }, { data: notifs }] = await Promise.all([
      supabase.from('accounts').select('*, token_timers(*)').is('deleted_at', null).eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('subscriptions').select('*').is('deleted_at', null).eq('user_id', user.id).order('next_billing_date', { ascending: true }).limit(5),
      supabase.from('accounts').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('user_id', user.id),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8)
    ])
    setAccounts(acc || [])
    setSubscriptions(subs || [])
    setTotalAccounts(accCount || 0)
    setActivity(notifs || [])
    setLoading(false)
    setTimeout(() => setIsLoaded(true), 100)
  }, [user])

  useEffect(() => { load() }, [load])

  // Auto-refresh activity every 60s
  useEffect(() => {
    const t = setInterval(async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8)
      setActivity(data || [])
    }, 60000)
    return () => clearInterval(t)
  }, [user])

  const expiringIn24h = accounts.filter(a => {
    if (!a.token_timers?.[0]?.next_due_at) return false
    return (new Date(a.token_timers[0].next_due_at) - new Date()) <= 86400000
  }).length

  const dueThisMonth = subscriptions.filter(s => {
    const d = daysUntil(s.next_billing_date)
    return d !== null && d >= 0 && d <= 30
  }).length

  const nextBill = subscriptions[0] || null

  // Calculate Ready Now accounts and Next To Return
  const accountsWithTimers = accounts.filter(a => a.token_timers && a.token_timers.some(t => !t.deleted_at))
  const readyAccs = []
  const cooldownAccs = []

  accounts.forEach(a => {
    const status = evaluateAccountStatus(a, now)
    if (status.hasTimers !== false) {
      if (status.isReady) {
        readyAccs.push({ account: a, status })
      } else {
        cooldownAccs.push({ account: a, status })
      }
    }
  })

  cooldownAccs.sort((a, b) => a.status.soonestAvailableMs - b.status.soonestAvailableMs)
  const nextToReturn = cooldownAccs[0] || null
  const nextGroup = nextToReturn ? nextToReturn.status.groups.find(g => !g.isReady && g.maxRemainingMs === nextToReturn.status.soonestAvailableMs) : null

  const bannerCount = readyAccs.length
  const showAlert = !bannerDismissed && bannerCount > 0
  
  const bannerColor = '#10b981'
  const bannerBg = 'rgba(16, 185, 129, 0.1)'
  const bannerBorder = 'rgba(16, 185, 129, 0.3)'
  const bannerTitle = `${bannerCount} account${bannerCount > 1 ? 's' : ''} ready to use`
  
  const bannerList = readyAccs.slice(0, 3).map(r => `${r.account.email} (${r.account.platform})`).join(', ') + 
    (bannerCount > 3 ? `, + ${bannerCount - 3} more` : '')

  const dismissBanner = () => {
    sessionStorage.setItem('dashboard_banner_dismissed', 'true')
    setBannerDismissed(true)
  }

  // Compute platform distribution
  const platformMap = {}
  accounts.forEach(a => {
    if (a.platform) platformMap[a.platform] = (platformMap[a.platform] || 0) + 1
  })
  const platformData = Object.entries(platformMap).map(([platform, count]) => ({ platform, count }))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Welcome back, {user?.email?.split('@')[0]}</p>
          {lastLogin && (
            <p className="text-[10px] mt-1 font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
              Last login: {new Date(lastLogin).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {lastBrowser && ` from ${lastBrowser}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-colors hover:bg-primary/90 shadow-xs">
            <Plus className="w-4 h-4" /> Add Account
          </button>
          <button onClick={() => setIsSubModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-semibold transition-colors hover:bg-muted shadow-xs">
            <Plus className="w-4 h-4" /> Add Subscription
          </button>
        </div>
      </div>

      <div className={`transition-all duration-500 space-y-6 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      
      {/* ── Alert Banner ── */}
      {showAlert && (
        <div 
          className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs">
              ✓
            </div>
            <div>
              <p className="font-semibold text-sm text-emerald-900 dark:text-emerald-200">{bannerTitle}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">{bannerList}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <Link 
              to="/accounts"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              View Accounts
            </Link>
            <button 
              onClick={dismissBanner}
              className="p-1 rounded-md text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Row 1: Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Accounts" value={totalAccounts} rawAccounts={accounts}
          icon={<Layers className="w-4 h-4" />} />
        <StatCard title="Ready Now" value={bannerCount}
          subtitle={`${readyAccs.length} available to use`}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} />
        <StatCard title="Bills This Month" value={dueThisMonth}
          subtitle="Upcoming renewals"
          icon={<Receipt className="w-4 h-4" />} />
        <StatCard
          title="Next Bill" value={nextBill ? nextBill.service_name : '—'}
          subtitle={nextBill ? formatDate(nextBill.next_billing_date) : 'No upcoming bills'}
          icon={<Calendar className="w-4 h-4" />} />
      </div>

      {/* ── Row 2: 3-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1.6fr_1.2fr] gap-5">

        {/* Left: Ready Now Card with Next to Return */}
        <Panel 
          title="Ready Now" 
          action={
            <Link to="/accounts" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: 'var(--ap-accent)' }}>
              <span>View all ({accounts.length})</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Layers className="w-10 h-10 mb-3 opacity-20" style={{ color: 'var(--foreground)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>No accounts yet</p>
              <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--muted-foreground)' }}>Add your AI or subscription accounts to start tracking quota.</p>
              <button 
                onClick={() => setIsAccountModalOpen(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: 'var(--ap-accent)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Ready Accounts List */}
              {accountsWithTimers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Clock className="w-8 h-8 mb-2 opacity-30 text-muted-foreground" />
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>No active timers configured</p>
                  <p className="text-xs mt-1 max-w-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    Your accounts don't have token cooldown timers set up yet.
                  </p>
                  <Link
                    to="/accounts"
                    className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border hover:bg-muted transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    Configure Timers →
                  </Link>
                </div>
              ) : readyAccs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Clock className="w-8 h-8 mb-2 opacity-30 text-amber-500" />
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Nothing ready yet</p>
                  <p className="text-xs mt-1 max-w-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    {nextToReturn ? (
                      <>
                        Next to return: <strong className="font-mono text-foreground">{nextToReturn.account.email}</strong>
                        {nextGroup && <span> ({nextGroup.groupName})</span>} in {formatDuration(nextToReturn.status.soonestAvailableMs)}.
                      </>
                    ) : (
                      "All accounts are currently on cooldown."
                    )}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40 overflow-y-auto" style={{ maxHeight: '260px' }}>
                  {readyAccs.map(({ account: acc, status }) => {
                    const readyGroups = status.groups.filter(g => g.isReady).map(g => g.groupName).join(', ')
                    return (
                      <li key={acc.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                        <div className="min-w-0 mr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{acc.email}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                navigator.clipboard.writeText(acc.email)
                                addToast({ type: 'success', message: 'Email copied to clipboard' })
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Copy email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: 'color-mix(in srgb, var(--ap-accent) 12%, transparent)', color: 'var(--ap-accent)' }}>
                              {acc.platform}
                            </span>
                            {readyGroups && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                                ✓ {readyGroups}
                              </span>
                            )}
                          </p>
                        </div>

                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>Ready</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Next Account to Return Section */}
              <div className="mt-auto p-4 border-t border-border bg-muted/30">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next To Return</span>
                  {nextToReturn && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>in {formatDuration(nextToReturn.status.soonestAvailableMs)}</span>
                    </span>
                  )}
                </div>

                {nextToReturn ? (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate text-foreground">{nextToReturn.account.email}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            navigator.clipboard.writeText(nextToReturn.account.email)
                            addToast({ type: 'success', message: 'Email copied to clipboard' })
                          }}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy email"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {nextToReturn.account.platform} · {nextGroup ? nextGroup.groupName : 'Cooldown ending'}
                      </p>
                    </div>
                    <Link 
                      to="/accounts" 
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted transition-colors shrink-0 text-foreground"
                    >
                      View
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {accountsWithTimers.length === 0
                      ? "No timers configured on your accounts yet."
                      : readyAccs.length > 0
                        ? "All accounts with timers are ready to use!"
                        : "No cooldown timers running."}
                  </p>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* Middle: Donut + Upcoming Bills stacked */}
        <div className="flex flex-col gap-5">
          <Panel title="Account Distribution">
            <div className="p-5">
              <DonutChart data={platformData} />
            </div>
          </Panel>

          <Panel title="Upcoming Bills" action={
            <Link to="/subscriptions" className="text-xs font-semibold text-primary hover:underline">View all →</Link>
          } className="flex-1">
            {subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Receipt className="w-8 h-8 mb-3 opacity-20 text-foreground" />
                <p className="text-sm text-muted-foreground">No subscriptions yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {subscriptions.map(sub => {
                  const days = daysUntil(sub.next_billing_date)
                  const urgent = days !== null && days <= 3
                  return (
                    <li key={sub.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        {urgent && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500 animate-pulse" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">{sub.service_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(sub.next_billing_date)}</p>
                        </div>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-sm font-semibold text-foreground tabular-nums">{sub.currency} {parseFloat(sub.amount).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {days === null ? '' : days < 0 ? 'Overdue' : days === 0 ? 'Due today' : `${days}d left`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* Right: Recent Activity */}
        <Panel title="Recent Activity" action={<Bell className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />}>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Bell className="w-8 h-8 mb-3 opacity-20" style={{ color: 'var(--foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No activity yet</p>
            </div>
          ) : (
            <ul className="overflow-y-auto" style={{ maxHeight: '360px' }}>
              {activity.map(n => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ background: n.is_read ? 'var(--border)' : 'var(--ap-accent)' }} />
                  <div className="min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{n.message}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>{timeAgo(n.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      </div>{/* end animation wrapper */}

      {/* Modals */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        account={null}
        onSave={load}
      />
      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        subscription={null}
        onSave={load}
      />
    </div>
  )
}
