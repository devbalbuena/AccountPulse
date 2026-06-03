import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import SubscriptionModal from '@/components/SubscriptionModal'
import { Search, MoreVertical, Pencil, Archive, History, Download, CreditCard, Copy, Check, PauseCircle } from 'lucide-react'

const CATEGORY_COLORS = {
  'Entertainment': '#ec4899',
  'Productivity': '#3b82f6',
  'Storage': '#06b6d4',
  'Dev Tools': '#a855f7',
  'Design': '#f97316',
  'Security': '#ef4444',
  'Finance': '#10b981',
  'Health': '#34d399',
  'Education': '#f59e0b',
  'Other': 'var(--muted)'
}

// Reusable color hash for avatars
const PALETTE = ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6']
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

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatMonthDay(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function advanceDate(dateStr, interval, customDays) {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  while (d < now) {
    if (interval === 'monthly' || !interval) d.setMonth(d.getMonth() + 1)
    else if (interval === 'quarterly') d.setMonth(d.getMonth() + 3)
    else if (interval === 'annually') d.setFullYear(d.getFullYear() + 1)
    else if (interval === 'custom' && customDays) d.setDate(d.getDate() + customDays)
    else d.setMonth(d.getMonth() + 1) // fallback
  }
  return d.toISOString()
}

// Progress Bar with tooltip
function ProgressBar({ pct, barColor, barGlow, pulse, isPaused, tooltip }) {
  const [show, setShow] = useState(false)
  const barStyle = {
    height: '100%',
    borderRadius: '9999px',
    width: `${pct}%`,
    background: isPaused
      ? 'rgba(128,128,128,0.4)'
      : `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
    boxShadow: isPaused ? 'none' : barGlow,
    transition: 'width 0.6s ease, box-shadow 0.3s ease',
    animation: pulse && !isPaused ? 'barPulse 1.8s ease-in-out infinite' : 'none',
  }
  return (
    <div className="relative mb-6 mt-1.5">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ height: '5px', borderRadius: '9999px', overflow: 'visible', background: 'rgba(128,128,128,0.12)', cursor: 'default', position: 'relative' }}
      >
        <div style={barStyle} />
      </div>
      {show && tooltip && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
          fontSize: '11px',
          padding: '4px 9px',
          borderRadius: '6px',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          zIndex: 30,
          pointerEvents: 'none',
        }}>
          {tooltip}
          <div style={{
            position: 'absolute',
            bottom: '-5px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '8px', height: '8px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderTop: 'none', borderLeft: 'none',
            transform: 'translateX(-50%) rotate(45deg)',
          }} />
        </div>
      )}
    </div>
  )
}

// Sub-component for the 3-dot menu on cards
function CardMenu({ onEdit, onArchive, isPaused, onTogglePause, serviceName }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(serviceName)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setOpen(false)
    }, 1500)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-muted"
        style={{ color: 'var(--muted-foreground)' }}>
        <MoreVertical className="w-4 h-4" />
      </button>
      
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <button onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            style={{ color: 'var(--foreground)' }}>
            <Pencil className="w-4 h-4 text-muted-foreground" /> Edit
          </button>
          <div className="h-px w-full" style={{ background: 'var(--border)' }} />
          <button onClick={() => { setOpen(false); onTogglePause(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            style={{ color: 'var(--foreground)' }}>
            <PauseCircle className="w-4 h-4 text-muted-foreground" /> {isPaused ? 'Resume Subscription' : 'Pause Subscription'}
          </button>
          <button onClick={() => { setOpen(false); onArchive(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-red-500/10 transition-colors text-left"
            style={{ color: '#ef4444' }}>
            <Archive className="w-4 h-4" /> Cancel & Archive
          </button>
          <div className="h-px w-full" style={{ background: 'var(--border)' }} />
          <button onClick={handleCopy}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            style={{ color: 'var(--foreground)' }}>
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />} 
            Copy Service Name
          </button>
        </div>
      )}
    </div>
  )
}

export default function SubscriptionsIndex() {
  const { user } = useAuth()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('subscriptions').select('*')
      .is('deleted_at', null).eq('user_id', user.id)
      .order('next_billing_date', { ascending: true })

    if (data && data.length > 0) {
      let changed = false
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      
      const updatedData = [...data]
      for (let i = 0; i < data.length; i++) {
        const sub = data[i]
        const nextBillDate = new Date(sub.next_billing_date)
        
        if (nextBillDate < now) {
           const newDateStr = advanceDate(sub.next_billing_date, sub.billing_interval, sub.custom_interval_days)
           const newDate = new Date(newDateStr)
           if (newDate > nextBillDate) {
             updatedData[i] = { ...sub, next_billing_date: newDateStr }
             supabase.from('subscriptions').update({ next_billing_date: newDateStr }).eq('id', sub.id).then(() => {})
             changed = true
           }
        }
      }
      
      if (changed) {
        updatedData.sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date))
        setSubs(updatedData)
      } else {
        setSubs(data)
      }
    } else {
      setSubs(data || [])
    }
    
    setLoading(false)
    setTimeout(() => setIsLoaded(true), 100)
  }, [user])

  useEffect(() => { load() }, [load])

  // Generate pseudo-history whenever subs change
  useEffect(() => {
    if (subs.length === 0) {
      setBillingHistory([])
      return
    }
    const history = []
    
    const statuses = ['Successful', 'Successful', 'Successful', 'Pending', 'Failed']
    const statusColors = {
      'Successful': '#22c55e',
      'Pending': '#f59e0b',
      'Failed': '#ef4444'
    }
    const channels = ['Visa ...1234', 'Mastercard ...5678', 'PayPal', 'Amex ...9012']

    subs.forEach(sub => {
      const nextDate = new Date(sub.next_billing_date)
      const interval = sub.billing_interval || 'monthly'
      
      // Generate 3 past cycles
      for (let i = 1; i <= 3; i++) {
        const pastDate = new Date(nextDate)
        
        if (interval === 'monthly') pastDate.setMonth(pastDate.getMonth() - i)
        else if (interval === 'quarterly') pastDate.setMonth(pastDate.getMonth() - (i * 3))
        else if (interval === 'annually') pastDate.setFullYear(pastDate.getFullYear() - i)
        else if (interval === 'custom' && sub.custom_interval_days) pastDate.setDate(pastDate.getDate() - (i * sub.custom_interval_days))
        else pastDate.setMonth(pastDate.getMonth() - i)

        if (pastDate < new Date()) {
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]
          const randomChannel = sub.payment_method || channels[Math.floor(Math.random() * channels.length)]
          
          history.push({
            id: `${sub.id}-${i}`,
            service_name: sub.service_name,
            icon_url: sub.icon_url,
            amount: sub.amount,
            currency: sub.currency,
            paid_on: pastDate,
            status: randomStatus,
            statusColor: statusColors[randomStatus],
            channel: randomChannel
          })
        }
      }
    })
    // Sort descending and take top 12
    history.sort((a, b) => b.paid_on - a.paid_on)
    setBillingHistory(history.slice(0, 12))
  }, [subs])

  async function handleArchive(id) {
    if (!confirm('Archive this subscription?')) return
    await supabase.from('subscriptions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function handleTogglePause(sub) {
    const newVal = sub.paused_at ? null : new Date().toISOString()
    await supabase.from('subscriptions').update({ paused_at: newVal }).eq('id', sub.id)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const filteredSubs = subs.filter(sub => 
    sub.service_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Summary Banner computed values
  const activeSubsList = subs.filter(s => !s.paused_at)
  const dueThisWeekCount = subs.filter(s => {
    const d = daysUntil(s.next_billing_date)
    return d !== null && d >= 0 && d <= 7
  }).length

  // Group spend by currency
  const spendByCurrency = {}
  activeSubsList.forEach(s => {
    const cur = s.currency || 'PHP'
    spendByCurrency[cur] = (spendByCurrency[cur] || 0) + parseFloat(s.amount || 0)
  })
  const spendText = Object.entries(spendByCurrency)
    .map(([cur, amt]) => `${cur} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(' + ') || '—'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Subscriptions</h2>
        <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            <input 
              type="text" 
              placeholder="Search services..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1 transition-colors"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <button onClick={() => { setEditingSub(null); setIsModalOpen(true); }}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium transition-all hover:opacity-90 shadow-sm"
            style={{ background: 'var(--ap-accent)' }}>
            + Add Sub
          </button>
        </div>
      </div>

      {/* ── Summary Banner ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 rounded-xl p-4 sm:px-6 shadow-sm dark:shadow-none border text-center sm:text-left gap-4 sm:gap-0 shrink-0"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        
        <div className="flex-1 flex flex-col items-center cursor-default rounded-lg px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Total Monthly Spend</p>
          <p className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{spendText}</p>
        </div>

        <div className="hidden sm:block w-px h-10" style={{ background: 'var(--border)' }} />

        <div className="flex-1 flex flex-col items-center cursor-default rounded-lg px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Active Subscriptions</p>
          <p className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{activeSubsList.length}</p>
        </div>

        <div className="hidden sm:block w-px h-10" style={{ background: 'var(--border)' }} />

        <div className="flex-1 flex flex-col items-center cursor-default rounded-lg px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Due This Week</p>
          <p className="text-xl font-bold" style={{ color: dueThisWeekCount > 0 ? '#f59e0b' : '#22c55e' }}>{dueThisWeekCount}</p>
        </div>
      </div>

      {/* ── Content Layout ── */}
      <div className={`transition-all duration-700 flex flex-col lg:flex-row items-start gap-5 flex-1 min-h-0 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        
        {/* Left Side: Card Grid */}
        <div className="flex-1 w-full min-w-0">
          {filteredSubs.length === 0 ? (
            <div className="rounded-2xl border flex flex-col items-center justify-center py-24 px-4 text-center"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <p className="font-medium" style={{ color: 'var(--muted-foreground)' }}>No subscriptions found</p>
              <button onClick={() => { setEditingSub(null); setIsModalOpen(true) }}
                className="mt-2 text-sm hover:underline" style={{ color: 'var(--ap-accent)' }}>Add a new subscription →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredSubs.map(sub => {
                const days = daysUntil(sub.next_billing_date)
                const initial = sub.service_name[0]?.toUpperCase() || '?'
                
                // ── Bar & Badge Logic ──────────────────────────────────
                const isPaused = !!sub.paused_at

                // Resolve category color (used for top border AND bar)
                const catColor = sub.category
                  ? (CATEGORY_COLORS[sub.category] || '#2563eb')
                  : '#2563eb'

                // Cycle length in days
                let cycleDays = 30
                const interval = sub.billing_interval || 'monthly'
                if (interval === 'quarterly') cycleDays = 90
                else if (interval === 'annually') cycleDays = 365
                else if (interval === 'custom' && sub.custom_interval_days)
                  cycleDays = parseInt(sub.custom_interval_days)

                // Elapsed-based progress
                const nextBill = sub.next_billing_date ? new Date(sub.next_billing_date) : null
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const daysLeft = nextBill ? Math.ceil((nextBill - today) / 86400000) : null
                const daysElapsed = daysLeft !== null ? cycleDays - daysLeft : null
                const progressPct = daysElapsed !== null
                  ? Math.max(0, Math.min(100, (daysElapsed / cycleDays) * 100))
                  : 0

                // Warning state overrides
                const isOverdue = daysLeft !== null && daysLeft < 0
                const isDueToday = daysLeft === 0
                const isDue3d = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
                const isDue7d = daysLeft !== null && daysLeft > 3 && daysLeft <= 7

                let barColor = catColor
                let barGlow = `0 0 6px ${catColor}66`
                let barPulse = false
                if (isPaused) {
                  barColor = 'rgba(128,128,128,0.5)'
                  barGlow = 'none'
                } else if (isOverdue || isDueToday || isDue3d) {
                  barColor = '#ef4444'
                  barGlow = '0 0 8px rgba(239,68,68,0.6)'
                  barPulse = true
                } else if (isDue7d) {
                  barColor = '#f59e0b'
                  barGlow = '0 0 6px rgba(245,158,11,0.5)'
                }

                const barPct = (isOverdue || isDueToday) ? 100 : progressPct

                // Status badge
                let statusBadge = { label: 'Active', bg: `${catColor}22`, text: catColor }
                if (isPaused) {
                  statusBadge = { label: 'Paused', bg: 'color-mix(in srgb,#f59e0b 20%,transparent)', text: '#f59e0b' }
                } else if (isDue3d || isDueToday || isOverdue) {
                  statusBadge = { label: 'Due Soon', bg: 'color-mix(in srgb,#ef4444 20%,transparent)', text: '#ef4444' }
                } else if (isDue7d) {
                  statusBadge = { label: 'Due Soon', bg: 'color-mix(in srgb,#f59e0b 20%,transparent)', text: '#f59e0b' }
                }

                // Cycle / interval badge
                const cycleBadge = !isPaused && sub.billing_interval === 'quarterly'
                  ? { label: 'Quarterly', bg: 'color-mix(in srgb,#06b6d4 15%,transparent)', text: '#06b6d4' }
                  : !isPaused && sub.billing_interval === 'annually'
                  ? { label: 'Annual', bg: 'color-mix(in srgb,#2563eb 15%,transparent)', text: '#2563eb' }
                  : null

                // Cycle label (pricing row)
                let cycleLabel = '/ mo'
                if (sub.billing_interval === 'quarterly') cycleLabel = '/ qtr'
                else if (sub.billing_interval === 'annually') cycleLabel = '/ yr'
                else if (sub.billing_interval === 'custom') cycleLabel = `/ ${sub.custom_interval_days}d`

                // Tooltip text
                const tooltipText = daysLeft !== null
                  ? `${Math.max(0, daysElapsed)}d of ${cycleDays}d elapsed · ${daysLeft > 0 ? daysLeft + 'd until next bill' : isOverdue ? 'Overdue by ' + Math.abs(daysLeft) + 'd' : 'Due today'}`
                  : 'No billing date set'

                return (
                  <div key={sub.id} 
                    className="rounded-2xl border flex flex-col transition-all duration-300 relative group overflow-hidden"
                    style={{ 
                      background: 'var(--card)', 
                      borderColor: 'var(--border)',
                      borderTop: `3px solid ${sub.category ? (CATEGORY_COLORS[sub.category] || '#2563eb') : '#2563eb'}`,
                      padding: '1.25rem 1.5rem 1.5rem',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = `0 4px 25px -5px color-mix(in srgb, var(--ap-accent2) 20%, transparent)`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = 'none'
                    }}>
                    
                    {/* Top Row */}
                    <div className="flex items-center justify-between mb-6 group/header">
                      <div className="flex items-center gap-3 min-w-0 pr-4 flex-1">
                        {sub.icon_url ? (
                          <img src={sub.icon_url} alt={sub.service_name} className="w-10 h-10 rounded-[10px] object-cover shrink-0 border shadow-sm" style={{ borderColor: 'var(--border)' }} />
                        ) : (
                          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 text-white font-bold text-lg shadow-sm" style={{ background: getPlatformColor(sub.service_name) }}>
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate text-[16px] tracking-tight w-full flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                            {sub.service_name}
                            {isPaused && <span className="text-amber-500 text-xs">⏸</span>}
                          </p>
                          {sub.category ? (
                            <div className="mt-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider" style={{ background: CATEGORY_COLORS[sub.category] || '#2563eb' }}>
                                {sub.category}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingSub(sub); setIsModalOpen(true); }}
                              className="text-[10px] mt-0.5 hover:underline"
                              style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}
                            >
                              + Add category
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 -mr-2 relative top-[-2px]">
                        <CardMenu 
                          onEdit={() => { setEditingSub(sub); setIsModalOpen(true); }}
                          onArchive={() => handleArchive(sub.id)}
                          isPaused={isPaused}
                          onTogglePause={() => handleTogglePause(sub)}
                          serviceName={sub.service_name}
                        />
                      </div>
                    </div>

                    {/* Pricing Row */}
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <span className="text-[22px] font-bold tracking-tight" style={{ color: isPaused ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                          {sub.currency} {parseFloat(sub.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                        <span className="text-xs ml-1 font-medium" style={{ color: 'var(--muted-foreground)' }}>
                          {cycleLabel}
                        </span>
                      </div>
                      <span className="text-xs font-semibold pb-1" style={{ color: barColor }}>
                        {daysLeft !== null ? (isOverdue ? 'Overdue' : isDueToday ? 'Due today' : `${daysLeft}d left`) : '—'}
                      </span>
                    </div>

                    {/* Progress Bar with Tooltip */}
                    <ProgressBar
                      pct={barPct}
                      barColor={barColor}
                      barGlow={barGlow}
                      pulse={barPulse}
                      isPaused={isPaused}
                      tooltip={tooltipText}
                    />

                    {/* Footer */}
                    <div className="mt-auto pt-4 flex items-center justify-between border-t" style={{ borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)' }}>
                      <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                        Next Bill: <span style={{ color: 'var(--foreground)' }}>{formatDateShort(sub.next_billing_date)}</span>
                        {sub.payment_method && (
                          <>
                            <span className="text-[10px] text-slate-400">•</span>
                            <CreditCard className="w-3 h-3" />
                            <span>{sub.payment_method}</span>
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {isOverdue && !isPaused && (
                          <div className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{ background: '#ef444420', color: '#ef4444' }}>Overdue</div>
                        )}
                        {cycleBadge && (
                          <div className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
                            style={{ background: cycleBadge.bg, color: cycleBadge.text }}>
                            {cycleBadge.label}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
                          style={{ background: statusBadge.bg, color: statusBadge.text }}>
                          <span
                            className={(!isPaused && !isOverdue) ? 'animate-pulse' : ''}
                            style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: statusBadge.text }}
                          />
                          {statusBadge.label}
                        </div>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Billing History Panel */}
        <div className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-4 rounded-2xl flex flex-col"
          style={{ background: 'var(--card)', maxHeight: 'calc(100vh - 7rem)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--foreground)' }}>Billing History</h3>
            <History className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {billingHistory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No history available</p>
              </div>
            ) : (
              <div className="relative mt-5">
                {billingHistory.map((n, idx) => {
                  return (
                    <div key={n.id} className="flex gap-4 relative group">
                      {/* Timeline Line */}
                      {idx !== billingHistory.length - 1 && (
                        <div className="absolute left-[11px] top-4 bottom-[-24px] w-px" style={{ background: 'color-mix(in srgb, var(--border) 80%, transparent)' }} />
                      )}
                      
                      {/* Node Bullet / Avatar */}
                      <div className="relative z-10 shrink-0 mt-[2px] w-6 h-6 rounded-md border-2 bg-card flex items-center justify-center"
                        style={{ borderColor: getPlatformColor(n.service_name), background: 'var(--card)' }}>
                        {n.icon_url ? (
                          <img src={n.icon_url} alt={n.service_name} className="w-full h-full rounded-sm object-cover" />
                        ) : (
                          <span className="text-[8px] font-bold text-foreground">{n.service_name[0]?.toUpperCase()}</span>
                        )}
                        {/* Status Dot */}
                        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2" 
                          style={{ background: n.statusColor, borderColor: 'var(--card)' }} 
                          title={n.status}
                        />
                      </div>
                      
                      {/* Content */}
                      <div className="pb-6 min-w-0 flex-1 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: 'var(--foreground)' }}>
                            {n.service_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                              {formatMonthDay(n.paid_on)}
                            </span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[11px] font-medium truncate" style={{ color: 'var(--muted-foreground)' }}>
                              {n.channel}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-[13px] font-bold shrink-0" style={{ color: 'var(--foreground)' }}>
                            {n.currency} {parseFloat(n.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </p>
                          <button className="text-muted-foreground hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" title="Download Receipt">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      <SubscriptionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        subscription={editingSub} 
        onSave={() => load()} 
      />
    </div>
  )
}
