import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import CountdownTimer from '@/components/CountdownTimer'
import AccountModal from '@/components/AccountModal'
import SubscriptionModal from '@/components/SubscriptionModal'
import { Layers, Clock, Receipt, Calendar, Plus, Bell } from 'lucide-react'

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

/* ─── Stat Card ─── */
function StatCard({ title, value, subtitle, icon, accent, sparkColor }) {
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
      <Sparkline color={sparkColor || accent} />
    </div>
  )
}

/* ─── SVG Donut Chart ─── */
const CHART_COLORS = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

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
      {/* ── Row 1: Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Accounts" value={totalAccounts}
          icon={<Layers className="w-4.5 h-4.5" />}
          accent="var(--ap-accent)" sparkColor="var(--ap-accent)" />
        <StatCard title="Expiring 24h" value={expiringIn24h}
          icon={<Clock className="w-4.5 h-4.5" />}
          accent="#ef4444" sparkColor="#ef4444" />
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

        {/* Left: Accounts List */}
        <Panel title="Accounts" action={
          <Link to="/accounts" className="text-xs font-medium hover:underline" style={{ color: 'var(--ap-accent)' }}>View all →</Link>
        }>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="w-10 h-10 mb-3 opacity-20" style={{ color: 'var(--foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No accounts yet</p>
            </div>
          ) : (
            <ul>
              {accounts.map(acc => (
                <li key={acc.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0 transition-colors hover:bg-muted/20"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{acc.email}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: 'color-mix(in srgb, var(--ap-accent) 12%, transparent)', color: 'var(--ap-accent)' }}>
                        {acc.platform}
                      </span>
                      {acc.type}
                    </p>
                  </div>
                  <CountdownTimer
                    nextDueAt={acc.token_timers?.[0]?.next_due_at}
                    accountId={acc.id} platform={acc.platform}
                    email={acc.email} userId={user.id}
                  />
                </li>
              ))}
            </ul>
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
