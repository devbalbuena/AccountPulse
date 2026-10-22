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

/* ─── Decorative sparkline SVG ─── */
function Sparkline({ color = 'var(--ap-accent)' }) {
  const path = "M0,28 C10,25 20,18 30,20 C40,22 50,10 60,8 C70,6 80,14 90,12 C100,10 110,16 120,12 L120,40 L0,40 Z"
  return (
    <svg viewBox="0 0 120 40" className="w-full h-10 mt-2" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <path d="M0,28 C10,25 20,18 30,20 C40,22 50,10 60,8 C70,6 80,14 90,12 C100,10 110,16 120,12"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Token Health Bar ─── */
function TokenHealthBar({ accounts }) {
  const validAccounts = (accounts || []).filter(a => a.token_timers && a.token_timers.length > 0)
  const total = validAccounts.length
  
  if (total === 0) {
    return (
      <div className="mt-2">
        <div className="w-full h-1.5 rounded-full bg-muted/60" />
        <div className="flex gap-2.5 text-[11px] mt-1.5 font-medium">
          <span className="text-muted-foreground">No active timers</span>
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
    <div className="mt-2">
      <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-muted/50">
        {rPct > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${rPct}%` }} />}
        {cPct > 0 && <div className="h-full bg-amber-500 transition-all" style={{ width: `${cPct}%` }} />}
      </div>
      <div className="flex gap-2.5 text-[11px] mt-1.5 font-medium">
        <span className="text-emerald-500">✓ {ready} ready</span>
        <span className="text-amber-500">⏳ {cooldown} on cooldown</span>
      </div>
    </div>
  )
}

/* ─── Stat Card ─── */
function StatCard({ title, value, subtitle, icon, accent, sparkColor, rawAccounts }) {
  return (
    <div className="rounded-2xl border p-5 flex flex-col relative overflow-hidden transition-shadow hover:shadow-md"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      {/* top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{title}</p>
          <p className="text-3xl font-bold mt-1 tabular-nums" style={{ color: 'var(--foreground)' }}>{value}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{subtitle}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
      {title === 'Total Accounts' ? (
        <TokenHealthBar accounts={rawAccounts || []} />
      ) : (
        <Sparkline color={sparkColor || accent} />
      )}
    </div>
  )
}

/* ─── SVG Donut Chart ─── */
const CHART_COLORS = ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function DonutChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-32" style={{ color: 'var(--muted-foreground)' }}>
      <p className="text-sm">No data</p>
    </div>
  )
  const total = data.reduce((s, d) => s + d.count, 0)
  const size = 110, cx = 55, cy = 55, r = 42, strokeW = 14
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
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeW} />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={strokeW}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-(s.offset - circ / 4)}
            strokeLinecap="butt" />
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="700"
          fill="var(--foreground)">{total}</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="truncate" style={{ color: 'var(--foreground)' }}>{s.platform}</span>
            <span className="ml-auto font-semibold tabular-nums pl-2 shrink-0" style={{ color: 'var(--muted-foreground)' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Card wrapper ─── */
function Panel({ title, action, children, className = '' }) {
  return (
    <div className={`rounded-2xl border flex flex-col overflow-hidden ${className}`}
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{title}</h3>
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
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)' }}>
            <Plus className="w-3.5 h-3.5" /> Account
          </button>
          <button onClick={() => setIsSubModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, var(--ap-accent3), #34d399)' }}>
            <Plus className="w-3.5 h-3.5" /> Subscription
          </button>
        </div>
      </div>

      <div className={`transition-all duration-700 space-y-6 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      
      {/* ── Alert Banner ── */}
      {showAlert && (
        <div 
          className="flex items-center justify-between p-3 sm:p-4 rounded-[10px] animate-in slide-in-from-top-4 fade-in duration-300"
          style={{
            background: bannerBg,
            border: `1px solid ${bannerBorder}`,
            borderLeft: `3px solid ${bannerColor}`
          }}
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full" style={{ background: bannerColor }}>
              <span className="text-white font-bold text-xs">!</span>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: bannerColor }}>{bannerTitle}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{bannerList}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-4">
            <Link 
              to="/accounts"
              className="px-3 sm:px-4 py-1.5 rounded-md text-xs font-bold border transition-colors hover:bg-white/10"
              style={{ color: bannerColor, borderColor: bannerColor }}
            >
              View Accounts
            </Link>
            <button 
              onClick={dismissBanner}
              className="p-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--muted-foreground)' }}
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
          icon={<Layers className="w-4.5 h-4.5" />}
          accent="var(--ap-accent)" sparkColor="var(--ap-accent)" />
        <StatCard title="Ready Now" value={bannerCount}
          icon={<CheckCircle2 className="w-4.5 h-4.5" />}
          accent="#10b981" sparkColor="#10b981" />
        <StatCard title="Bills This Month" value={dueThisMonth}
          icon={<Receipt className="w-4.5 h-4.5" />}
          accent="var(--ap-accent2)" sparkColor="var(--ap-accent2)" />
        <StatCard
          title="Next Bill" value={nextBill ? nextBill.service_name : '—'}
          subtitle={nextBill ? formatDate(nextBill.next_billing_date) : 'No upcoming bills'}
          icon={<Calendar className="w-4.5 h-4.5" />}
          accent="var(--ap-accent3)" sparkColor="var(--ap-accent3)" />
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

                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>Ready</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Next Account to Return Section */}
              <div className="mt-auto p-4 border-t border-border/70 bg-muted/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Next To Return</span>
                  {nextToReturn && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>in {formatDuration(nextToReturn.status.soonestAvailableMs)}</span>
                    </span>
                  )}
                </div>

                {nextToReturn ? (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border bg-card" style={{ borderColor: 'var(--border)' }}>
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
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {nextToReturn.account.platform} · {nextGroup ? nextGroup.groupName : 'Cooldown ending'}
                      </p>
                    </div>
                    <Link 
                      to="/accounts" 
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border hover:bg-muted transition-colors shrink-0 text-muted-foreground hover:text-foreground"
                      style={{ borderColor: 'var(--border)' }}
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
            <Link to="/subscriptions" className="text-xs font-medium hover:underline" style={{ color: 'var(--ap-accent3)' }}>View all →</Link>
          } className="flex-1">
            {subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Receipt className="w-8 h-8 mb-3 opacity-20" style={{ color: 'var(--foreground)' }} />
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No subscriptions yet</p>
              </div>
            ) : (
              <ul>
                {subscriptions.map(sub => {
                  const days = daysUntil(sub.next_billing_date)
                  const urgent = days !== null && days <= 3
                  return (
                    <li key={sub.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0"
                      style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        {urgent && <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: '#ef4444' }} />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{sub.service_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{formatDate(sub.next_billing_date)}</p>
                        </div>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--ap-accent3)' }}>{sub.currency} {parseFloat(sub.amount).toFixed(2)}</p>
                        <p className="text-[11px]" style={{ color: urgent ? '#ef4444' : 'var(--muted-foreground)' }}>
                          {days === null ? '' : days < 0 ? 'Overdue' : days === 0 ? 'Due today' : `${days}d`}
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
