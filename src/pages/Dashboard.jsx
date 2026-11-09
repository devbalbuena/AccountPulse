import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import AccountModal from '@/components/AccountModal'
import SubscriptionModal from '@/components/SubscriptionModal'
import { evaluateAccountStatus, formatDuration } from '@/lib/durationUtils'
import { useNow } from '@/context/TimeContext'
import { resolveUnifiedPlatform, UnifiedPlatformIcon } from '@/lib/platformCategories'
import { saveOfflineCache, loadOfflineCache } from '@/lib/pwaOfflineCache'
import {
  Layers,
  Clock,
  Receipt,
  Plus,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  RotateCcw,
  CreditCard,
} from 'lucide-react'
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

function CopyIconBtn({ text, label = 'Copy email' }) {
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  function handleCopy(e) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    addToast({ type: 'success', message: 'Copied to clipboard' })
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      className="w-6 h-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

/* ─── Panel Container ─── */
function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-border bg-card flex flex-col overflow-hidden shadow-xs ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-foreground tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [totalAccounts, setTotalAccounts] = useState(0)
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)

  const now = useNow()
  const { addToast } = useToast()

  const load = useCallback(async () => {
    try {
      const [{ data: acc, error: accErr }, { data: subs, error: subErr }, { count: accCount }] = await Promise.all([
        supabase
          .from('accounts')
          .select('*, token_timers(*)')
          .is('deleted_at', null)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('*')
          .is('deleted_at', null)
          .eq('user_id', user.id)
          .order('next_billing_date', { ascending: true }),
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('user_id', user.id),
      ])
      if (accErr || subErr) throw accErr || subErr
      const safeAcc = acc || []
      const safeSubs = subs || []
      setAccounts(safeAcc)
      setSubscriptions(safeSubs)
      setTotalAccounts(accCount ?? safeAcc.length)
      saveOfflineCache('accounts', safeAcc)
      saveOfflineCache('subscriptions', safeSubs)
    } catch {
      const cachedAcc = loadOfflineCache('accounts', [])
      const cachedSubs = loadOfflineCache('subscriptions', [])
      setAccounts(cachedAcc)
      setSubscriptions(cachedSubs)
      setTotalAccounts(cachedAcc.length)
    } finally {
      setLoading(false)
      setTimeout(() => setIsLoaded(true), 60)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function handleQuickDrain(timer, account) {
    if (!timer || !timer.interval_hours) {
      addToast({ type: 'info', message: 'No interval configured on this timer.' })
      return
    }
    const nowDate = new Date()
    const cooldownMs = (timer.interval_hours || 0) * 3600000
    const nextDue = new Date(nowDate.getTime() + cooldownMs)
    const prevNextDueAt = timer.next_due_at
    const prevLastRefreshedAt = timer.last_refreshed_at

    const { error } = await supabase
      .from('token_timers')
      .update({
        last_refreshed_at: nowDate.toISOString(),
        next_due_at: nextDue.toISOString(),
      })
      .eq('id', timer.id)

    if (error) {
      addToast({ type: 'error', message: `Failed to start cooldown: ${error.message}` })
      return
    }

    const durationText = formatDuration(cooldownMs)
    addToast({
      type: 'success',
      message: `${timer.model_name || 'Timer'} cooling down (${durationText})`,
      action: {
        label: 'Undo',
        onClick: async () => {
          await supabase
            .from('token_timers')
            .update({
              next_due_at: prevNextDueAt,
              last_refreshed_at: prevLastRefreshedAt,
            })
            .eq('id', timer.id)
          addToast({ type: 'info', message: `Restored ${timer.model_name || 'Timer'}` })
          load()
        },
      },
    })

    await supabase.from('notifications').insert({
      user_id: user.id,
      message: `${account.email} (${timer.model_name || 'Timer'}) marked as drained (${durationText} cooldown)`,
      is_read: false,
    })
    load()
  }

  // Evaluate statuses
  const accountsWithTimers = accounts.filter(
    a => a.token_timers && a.token_timers.some(t => !t.deleted_at)
  )
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
  const nextGroup = nextToReturn
    ? nextToReturn.status.groups.find(
        g => !g.isReady && g.maxRemainingMs === nextToReturn.status.soonestAvailableMs
      )
    : null

  // Monthly subscriptions summary
  const activeSubs = subscriptions.filter(s => s.status !== 'paused' && s.status !== 'cancelled')
  const monthlySpend = activeSubs.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const primaryCurrency = activeSubs[0]?.currency || subscriptions[0]?.currency || 'PHP'
  const nextBill = subscriptions[0] || null
  const nextBillDays = nextBill ? daysUntil(nextBill.next_billing_date) : null

  // Unified Platform Category Breakdown (eliminates duplicate trailing-space entries)
  const categoryMap = new Map()
  accounts.forEach(a => {
    const unified = resolveUnifiedPlatform(a.platform, a.type, accounts, a.icon_url)
    const existing = categoryMap.get(unified.key)
    const status = evaluateAccountStatus(a, now)
    const isReady = status.hasTimers !== false && status.isReady
    if (existing) {
      existing.count += 1
      if (isReady) existing.ready += 1
    } else {
      categoryMap.set(unified.key, {
        ...unified,
        count: 1,
        ready: isReady ? 1 : 0,
      })
    }
  })
  const unifiedPlatforms = Array.from(categoryMap.values())

  const trackedTotal = accountsWithTimers.length
  const rPct = trackedTotal > 0 ? (readyAccs.length / trackedTotal) * 100 : 0
  const cPct = trackedTotal > 0 ? (cooldownAccs.length / trackedTotal) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* ── Compact Single Header ── */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Command Center</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live quota availability &amp; subscription pulse
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAccountModalOpen(true)}
            title="Add Account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-colors hover:bg-primary/90 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Account</span>
          </button>
          <button
            onClick={() => setIsSubModalOpen(true)}
            title="Add Subscription"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold transition-colors hover:bg-muted shadow-xs"
          >
            <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Subscription</span>
          </button>
        </div>
      </div>

      <div
        className={`transition-all duration-300 space-y-5 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        }`}
      >
        {/* ── 3 Non-Overlapping Summary Cards (Zero Duplication) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Quota Availability */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quota Availability
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums"
                style={{
                  background: 'var(--ready-bg)',
                  color: 'var(--ready-text)',
                  borderColor: 'var(--ready-border)',
                }}
              >
                {readyAccs.length} of {totalAccounts} Ready
              </span>
            </div>

            <div className="my-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                {readyAccs.length}
              </span>
              <span className="text-xs text-muted-foreground">
                available now &bull;{' '}
                <strong className="text-foreground tabular-nums">{cooldownAccs.length}</strong> on cooldown
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex gap-0.5">
              {rPct > 0 && (
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${rPct}%` }}
                />
              )}
              {cPct > 0 && (
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${cPct}%` }}
                />
              )}
            </div>
          </div>

          {/* Card 2: Next Returning Quota */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Next Returning
              </span>
              {nextToReturn ? (
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1 tabular-nums"
                  style={{
                    background: 'var(--cooldown-bg)',
                    color: 'var(--cooldown-text)',
                    borderColor: 'var(--cooldown-border)',
                  }}
                >
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(nextToReturn.status.soonestAvailableMs)}</span>
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">Idle</span>
              )}
            </div>

            {nextToReturn ? (
              <div className="my-2 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold font-mono text-foreground truncate">
                    {nextToReturn.account.email}
                  </p>
                  <CopyIconBtn text={nextToReturn.account.email} />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {resolveUnifiedPlatform(nextToReturn.account.platform, nextToReturn.account.type).name}
                  {nextGroup ? ` · ${nextGroup.groupName}` : ''}
                </p>
              </div>
            ) : (
              <div className="my-2">
                <p className="text-sm font-semibold text-foreground">
                  {accountsWithTimers.length === 0 ? 'No active timers' : 'All accounts ready'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {accountsWithTimers.length === 0
                    ? 'Add timers on the Accounts page'
                    : 'Zero accounts currently in cooldown'}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {cooldownAccs.length > 1
                  ? `+${cooldownAccs.length - 1} more in cooldown queue`
                  : 'Real-time 1s precision tick'}
              </span>
              <Link to="/accounts" className="font-semibold text-primary hover:underline">
                Accounts →
              </Link>
            </div>
          </div>

          {/* Card 3: Subscriptions & Next Bill */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Subscriptions
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-foreground tabular-nums">
                {activeSubs.length} Active
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {primaryCurrency} {monthlySpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-muted-foreground">/mo</span>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
              {nextBill ? (
                <>
                  <span className="text-muted-foreground truncate pr-2">
                    Next: <strong className="text-foreground">{nextBill.service_name}</strong> ({formatDate(nextBill.next_billing_date)})
                  </span>
                  <span className="font-semibold text-foreground shrink-0 tabular-nums">
                    {nextBillDays === null
                      ? ''
                      : nextBillDays < 0
                        ? 'Overdue'
                        : nextBillDays === 0
                          ? 'Today'
                          : `${nextBillDays}d`}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No upcoming renewals</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Main 2-Column Workspace ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Left 2 Columns: Ready to Use Queue with Icon-Only Quick Actions */}
          <Panel
            className="lg:col-span-2"
            title="Ready to Use Queue"
            subtitle="Copy account email or trigger model cooldown with one icon click"
            action={
              <Link
                to="/accounts"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>All ({accounts.length})</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Layers className="w-9 h-9 mb-2.5 opacity-20 text-foreground" />
                <p className="text-sm font-semibold text-foreground">No accounts tracked yet</p>
                <p className="text-xs mt-1 max-w-xs text-muted-foreground">
                  Add your AI or developer accounts to track quota cooldowns.
                </p>
                <button
                  onClick={() => setIsAccountModalOpen(true)}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Account
                </button>
              </div>
            ) : accountsWithTimers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Clock className="w-8 h-8 mb-2 opacity-30 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">No active timers configured</p>
                <p className="text-xs mt-1 max-w-xs text-muted-foreground">
                  Your accounts don&apos;t have token cooldown timers set up yet.
                </p>
                <Link
                  to="/accounts"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-muted text-foreground"
                >
                  Configure Timers →
                </Link>
              </div>
            ) : readyAccs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Clock className="w-8 h-8 mb-2 text-amber-500 opacity-60" />
                <p className="text-sm font-semibold text-foreground">All accounts are on cooldown</p>
                <p className="text-xs mt-1 max-w-xs text-muted-foreground">
                  {nextToReturn ? (
                    <>
                      Next ready: <strong className="font-mono text-foreground">{nextToReturn.account.email}</strong> in{' '}
                      {formatDuration(nextToReturn.status.soonestAvailableMs)}.
                    </>
                  ) : (
                    'Check back when cooldown timers complete.'
                  )}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {readyAccs.map(({ account: acc, status }) => {
                  const unified = resolveUnifiedPlatform(acc.platform, acc.type, accounts, acc.icon_url)
                  const readyGroups = status.groups.filter(g => g.isReady)

                  return (
                    <div
                      key={acc.id}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-muted/30 transition-colors"
                    >
                      {/* Email-First + Unified Platform Icon */}
                      <div className="flex items-center gap-3 min-w-0">
                        <UnifiedPlatformIcon
                          platform={acc.platform}
                          type={acc.type}
                          allAccounts={accounts}
                          iconUrl={acc.icon_url}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs sm:text-sm font-bold font-mono text-foreground truncate" title={acc.email}>
                              {acc.email}
                            </p>
                            <CopyIconBtn text={acc.email} />
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground/80">{unified.name}</span>
                            <span>&bull;</span>
                            <span>{unified.category}</span>
                          </div>
                        </div>
                      </div>

                      {/* Compact Group Pills with Icon-Only Drain Button */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {readyGroups.map(g => {
                          const primaryTimer = g.timers?.[0]
                          const canDrain = primaryTimer && (primaryTimer.interval_hours || 0) > 0
                          return (
                            <div
                              key={g.groupName}
                              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full border text-[11px] font-semibold"
                              style={{
                                background: 'var(--ready-bg)',
                                color: 'var(--ready-text)',
                                borderColor: 'var(--ready-border)',
                              }}
                            >
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>{g.groupName}</span>
                              {canDrain && g.timers.length === 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickDrain(primaryTimer, acc)}
                                  title={`Drain ${g.groupName} (start cooldown)`}
                                  className="ml-0.5 w-5 h-5 rounded-full inline-flex items-center justify-center hover:bg-emerald-700/15 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>

          {/* Right Column: Unified Categories + Cooldown Queue + Upcoming Bills */}
          <div className="space-y-4">
            {/* Unified AI Platform Categories */}
            {unifiedPlatforms.length > 0 && (
              <Panel title="AI Platform Categories" subtitle="Unified by canonical platform">
                <div className="divide-y divide-border">
                  {unifiedPlatforms.map(p => (
                    <Link
                      key={p.key}
                      to="/accounts"
                      className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UnifiedPlatformIcon
                          platform={p.name}
                          type={p.category}
                          allAccounts={accounts}
                          iconUrl={p.iconUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums"
                          style={{
                            background: 'var(--ready-bg)',
                            color: 'var(--ready-text)',
                            borderColor: 'var(--ready-border)',
                          }}
                        >
                          {p.ready}/{p.count} ready
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Panel>
            )}

            {/* Active Cooldowns Queue */}
            {cooldownAccs.length > 0 && (
              <Panel
                title="Active Cooldowns"
                action={
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                    {cooldownAccs.length} cooling
                  </span>
                }
              >
                <div className="divide-y divide-border">
                  {cooldownAccs.slice(0, 5).map(({ account: acc, status }) => (
                    <div key={acc.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold font-mono text-foreground truncate">{acc.email}</p>
                          <CopyIconBtn text={acc.email} />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {resolveUnifiedPlatform(acc.platform, acc.type).name}
                        </p>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 tabular-nums"
                        style={{
                          background: 'var(--cooldown-bg)',
                          color: 'var(--cooldown-text)',
                          borderColor: 'var(--cooldown-border)',
                        }}
                      >
                        {formatDuration(status.soonestAvailableMs)}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Upcoming Bills */}
            <Panel
              title="Upcoming Renewals"
              action={
                <Link to="/subscriptions" className="text-xs font-semibold text-primary hover:underline">
                  All →
                </Link>
              }
            >
              {subscriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Receipt className="w-7 h-7 mb-2 opacity-20 text-foreground" />
                  <p className="text-xs text-muted-foreground">No subscriptions tracked</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {subscriptions.slice(0, 4).map(sub => {
                    const days = daysUntil(sub.next_billing_date)
                    const urgent = days !== null && days <= 3
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {urgent && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500 animate-pulse" />}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate text-foreground">{sub.service_name}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(sub.next_billing_date)}</p>
                          </div>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <p className="text-xs font-bold text-foreground tabular-nums">
                            {sub.currency} {parseFloat(sub.amount).toFixed(2)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {days === null ? '' : days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d left`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>

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
