import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import SubscriptionModal from '@/components/SubscriptionModal'
import { Search, MoreVertical, Pencil, Archive, History, Download, CreditCard, Copy, Check, PauseCircle, Calendar, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'

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
  'Other': '#6b7280'
}

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
    else d.setMonth(d.getMonth() + 1)
  }
  return d.toISOString()
}

// ─── Progress Bar ───
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

// ─── Card Menu ───
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
    setTimeout(() => { setCopied(false); setOpen(false) }, 1500)
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

// ─── Inline Edit Field ───
function InlineEdit({ value, onSave, onCancel, placeholder, prefix = '' }) {
  const [val, setVal] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKey(e) {
    if (e.key === 'Enter') onSave(val)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      {prefix && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{prefix}</span>}
      <input
        ref={inputRef}
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => onSave(val)}
        placeholder={placeholder}
        className="w-24 px-2 py-1 text-sm rounded-md outline-none"
        style={{
          background: 'var(--input-bg)',
          border: '2px solid var(--border)',
          color: 'var(--foreground)',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#4f46e5' }}
      />
      <button onMouseDown={e => { e.preventDefault(); onSave(val) }}
        className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10 transition-colors">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onMouseDown={e => { e.preventDefault(); onCancel() }}
        className="p-1 rounded hover:bg-muted transition-colors"
        style={{ color: 'var(--muted-foreground)' }}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Subscription Calendar ───
function SubscriptionCalendar({ subs }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [popoverDay, setPopoverDay] = useState(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setPopoverDay(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7 // Make Monday = 0
  const daysInMonth = lastDay.getDate()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Map subs to day numbers
  const subsByDay = {}
  subs.forEach(sub => {
    if (!sub.next_billing_date) return
    const d = new Date(sub.next_billing_date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!subsByDay[day]) subsByDay[day] = []
      subsByDay[day].push(sub)
    }
  })

  // Build grid cells
  const cells = []
  // Padding before
  for (let i = 0; i < startPad; i++) {
    const prevDay = new Date(year, month, -startPad + i + 1)
    cells.push({ date: prevDay, isCurrentMonth: false, dayNum: prevDay.getDate() })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true, dayNum: d })
  }
  // Padding after (fill to complete grid rows)
  const remaining = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, dayNum: i })
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function goBack() { setCurrentDate(new Date(year, month - 1, 1)); setPopoverDay(null) }
  function goForward() { setCurrentDate(new Date(year, month + 1, 1)); setPopoverDay(null) }

  // Legend: all subs with next_billing_date in current month, sorted
  const legendSubs = subs
    .filter(s => {
      if (!s.next_billing_date) return false
      const d = new Date(s.next_billing_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date))

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>{monthName}</h3>
          <div className="flex items-center gap-1">
            <button onClick={goBack}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted"
              style={{ color: 'var(--muted-foreground)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goForward}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted"
              style={{ color: 'var(--muted-foreground)' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
          {weekdays.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--muted-foreground)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const isToday = cell.isCurrentMonth &&
              cell.date.getFullYear() === today.getFullYear() &&
              cell.date.getMonth() === today.getMonth() &&
              cell.date.getDate() === today.getDate()
            const daySubs = cell.isCurrentMonth ? (subsByDay[cell.dayNum] || []) : []
            const hasMore = daySubs.length > 2
            const visible = daySubs.slice(0, 2)

            return (
              <div
                key={idx}
                onClick={() => daySubs.length > 0 ? setPopoverDay(cell.dayNum === popoverDay ? null : cell.dayNum) : null}
                className="border-r border-b p-1.5 relative transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  minHeight: '80px',
                  cursor: daySubs.length > 0 ? 'pointer' : 'default',
                  background: daySubs.length > 0 ? `color-mix(in srgb, ${CATEGORY_COLORS[daySubs[0].category] || '#2563eb'} 4%, var(--card))` : 'transparent',
                }}
                onMouseEnter={e => { if (!daySubs.length) e.currentTarget.style.background = 'var(--muted)/20' }}
                onMouseLeave={e => { e.currentTarget.style.background = daySubs.length > 0 ? `color-mix(in srgb, ${CATEGORY_COLORS[daySubs[0].category] || '#2563eb'} 4%, var(--card))` : 'transparent' }}
              >
                {/* Day number */}
                <div className="flex justify-end mb-1">
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'text-white' : ''}`}
                    style={{
                      background: isToday ? '#4f46e5' : 'transparent',
                      color: isToday ? 'white' : cell.isCurrentMonth ? 'var(--foreground)' : 'var(--muted-foreground)',
                      opacity: cell.isCurrentMonth ? 1 : 0.4,
                    }}
                  >
                    {cell.dayNum}
                  </span>
                </div>

                {/* Sub pills */}
                <div className="flex flex-col gap-0.5">
                  {visible.map(sub => {
                    const color = CATEGORY_COLORS[sub.category] || '#2563eb'
                    return (
                      <div key={sub.id}
                        className="truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
                        style={{
                          background: `color-mix(in srgb, ${color} 20%, transparent)`,
                          color,
                          border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                        }}
                      >
                        {sub.service_name}
                      </div>
                    )
                  })}
                  {hasMore && (
                    <div className="text-[9px] font-bold px-1" style={{ color: 'var(--muted-foreground)' }}>
                      +{daySubs.length - 2} more
                    </div>
                  )}
                </div>

                {/* Popover */}
                {popoverDay === cell.dayNum && cell.isCurrentMonth && (
                  <div
                    ref={popoverRef}
                    className="absolute z-50 left-0 top-full mt-1 w-64 rounded-xl shadow-2xl border animate-in fade-in zoom-in-95 duration-150"
                    style={{
                      background: 'var(--card)',
                      borderColor: 'var(--border)',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                        Due {new Date(year, month, cell.dayNum).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      {daySubs.map(sub => {
                        const color = CATEGORY_COLORS[sub.category] || '#2563eb'
                        return (
                          <div key={sub.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                            style={{ background: `color-mix(in srgb, ${color} 8%, var(--card))` }}>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>{sub.service_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {sub.category && (
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm text-white" style={{ background: color }}>
                                    {sub.category}
                                  </span>
                                )}
                                {sub.payment_method && (
                                  <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{sub.payment_method}</span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm font-bold shrink-0 ml-2" style={{ color: 'var(--foreground)' }}>
                              {sub.currency} {parseFloat(sub.amount).toFixed(2)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      {legendSubs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
          {legendSubs.map(sub => {
            const color = CATEGORY_COLORS[sub.category] || '#2563eb'
            return (
              <div key={sub.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                  {sub.service_name}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formatMonthDay(sub.next_billing_date)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───
export default function SubscriptionsIndex() {
  const { user } = useAuth()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])

  // Feature 1: Filtering & Sorting
  const [activeFilters, setActiveFilters] = useState(['All'])
  const [sortBy, setSortBy] = useState('soonest')
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)

  // Feature 2: Budget
  const [budgetLimit, setBudgetLimit] = useState(() => {
    const v = localStorage.getItem('accountpulse_budget_limit')
    return v ? parseFloat(v) : null
  })
  const [usdRate, setUsdRate] = useState(() => {
    const v = localStorage.getItem('accountpulse_usd_to_php_rate')
    return v ? parseFloat(v) : 56
  })
  const [editingBudget, setEditingBudget] = useState(false)
  const [editingRate, setEditingRate] = useState(false)

  // Feature 3: Calendar
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('accountpulse_sub_view') || 'grid')

  // Close sort dropdown on outside click
  useEffect(() => {
    function handle(e) { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function toggleView(mode) {
    setViewMode(mode)
    localStorage.setItem('accountpulse_sub_view', mode)
  }

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

  // Billing history generation
  useEffect(() => {
    if (subs.length === 0) { setBillingHistory([]); return }
    const history = []
    const statuses = ['Successful', 'Successful', 'Successful', 'Pending', 'Failed']
    const statusColors = { 'Successful': '#22c55e', 'Pending': '#f59e0b', 'Failed': '#ef4444' }
    const channels = ['Visa ...1234', 'Mastercard ...5678', 'PayPal', 'Amex ...9012']

    subs.forEach(sub => {
      const nextDate = new Date(sub.next_billing_date)
      const interval = sub.billing_interval || 'monthly'
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
            id: `${sub.id}-${i}`, service_name: sub.service_name, icon_url: sub.icon_url,
            amount: sub.amount, currency: sub.currency, paid_on: pastDate,
            status: randomStatus, statusColor: statusColors[randomStatus], channel: randomChannel
          })
        }
      }
    })
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

  // ── Budget helpers ──
  function saveBudget(val) {
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) {
      setBudgetLimit(n)
      localStorage.setItem('accountpulse_budget_limit', String(n))
    } else if (val === '' || val === '0') {
      setBudgetLimit(null)
      localStorage.removeItem('accountpulse_budget_limit')
    }
    setEditingBudget(false)
  }

  function saveRate(val) {
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) {
      setUsdRate(n)
      localStorage.setItem('accountpulse_usd_to_php_rate', String(n))
    }
    setEditingRate(false)
  }

  // ── Computed values ──
  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const activeSubsList = subs.filter(s => !s.paused_at)
  const dueThisWeekCount = subs.filter(s => {
    const d = daysUntil(s.next_billing_date)
    return d !== null && d >= 0 && d <= 7
  }).length

  // Spend with currency conversion
  let totalPhp = 0
  let usedConversion = false
  activeSubsList.forEach(s => {
    const amt = parseFloat(s.amount || 0)
    if ((s.currency || 'PHP') === 'PHP') {
      totalPhp += amt
    } else {
      totalPhp += amt * usdRate
      usedConversion = true
    }
  })

  // Legacy spendText for display
  const spendByCurrency = {}
  activeSubsList.forEach(s => {
    const cur = s.currency || 'PHP'
    spendByCurrency[cur] = (spendByCurrency[cur] || 0) + parseFloat(s.amount || 0)
  })
  const spendText = Object.entries(spendByCurrency)
    .map(([cur, amt]) => `${cur} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(' + ') || '—'

  // Budget alert state
  let budgetRatio = 0
  let budgetStatus = 'none' // none | ok | warning | exceeded
  if (budgetLimit) {
    budgetRatio = totalPhp / budgetLimit
    if (budgetRatio >= 1) budgetStatus = 'exceeded'
    else if (budgetRatio >= 0.75) budgetStatus = 'warning'
    else budgetStatus = 'ok'
  }

  const bannerBorderColor = budgetStatus === 'exceeded' ? '#ef4444' : budgetStatus === 'warning' ? '#f59e0b' : 'transparent'

  // Spend display color
  const spendColor = budgetStatus === 'exceeded' ? '#ef4444' : 'var(--foreground)'

  // Warning text
  let warningText = null
  if (budgetStatus === 'warning') warningText = { text: `${Math.round(budgetRatio * 100)}% of monthly budget used`, color: '#f59e0b' }
  if (budgetStatus === 'exceeded') warningText = { text: 'Monthly budget exceeded!', color: '#ef4444' }

  // Budget display value
  const budgetColor = budgetStatus === 'exceeded' ? '#ef4444' : budgetStatus === 'warning' ? '#f59e0b' : '#10b981'

  // ── Filter / Sort ──
  const uniqueCategories = [...new Set(subs.map(s => s.category).filter(Boolean))]

  const SORT_OPTIONS = [
    { value: 'soonest', label: 'Sort: Due Soonest' },
    { value: 'latest', label: 'Sort: Due Latest' },
    { value: 'high', label: 'Sort: Cost High to Low' },
    { value: 'low', label: 'Sort: Cost Low to High' },
    { value: 'alpha', label: 'Sort: Alphabetical' },
    { value: 'recent', label: 'Sort: Recently Added' },
  ]

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort'

  function toggleFilter(chip) {
    if (chip === 'All') {
      setActiveFilters(['All'])
    } else {
      setActiveFilters(prev => {
        const without = prev.filter(f => f !== 'All')
        if (without.includes(chip)) {
          const next = without.filter(f => f !== chip)
          return next.length === 0 ? ['All'] : next
        } else {
          return [...without, chip]
        }
      })
    }
  }

  function isFilterActive(chip) { return activeFilters.includes(chip) }

  const STATUS_CHIPS = ['All', 'Due This Week', 'Due This Month', 'Paused']

  // Apply search + filters + sort
  let filteredSubs = subs.filter(sub => {
    if (!sub.service_name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (activeFilters.includes('All')) return true

    // AND logic — sub must pass ALL active filters
    for (const f of activeFilters) {
      if (f === 'Due This Week') {
        const d = daysUntil(sub.next_billing_date)
        if (!(d !== null && d >= 0 && d <= 7)) return false
      } else if (f === 'Due This Month') {
        const d = daysUntil(sub.next_billing_date)
        if (!(d !== null && d >= 0 && d <= 30)) return false
      } else if (f === 'Paused') {
        if (!sub.paused_at) return false
      } else {
        // Category filter
        if (sub.category !== f) return false
      }
    }
    return true
  })

  // Sort
  filteredSubs = [...filteredSubs].sort((a, b) => {
    if (sortBy === 'soonest') return new Date(a.next_billing_date) - new Date(b.next_billing_date)
    if (sortBy === 'latest') return new Date(b.next_billing_date) - new Date(a.next_billing_date)
    if (sortBy === 'high') return parseFloat(b.amount) - parseFloat(a.amount)
    if (sortBy === 'low') return parseFloat(a.amount) - parseFloat(b.amount)
    if (sortBy === 'alpha') return a.service_name.localeCompare(b.service_name)
    if (sortBy === 'recent') return new Date(b.created_at) - new Date(a.created_at)
    return 0
  })

  const filtersActive = !activeFilters.includes('All') || searchQuery.trim() !== ''
  const countLabel = filtersActive ? `(${filteredSubs.length} of ${subs.length})` : ''

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Subscriptions</h2>
          {countLabel && (
            <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{countLabel}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-56">
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
          {/* Calendar Toggle */}
          <button
            onClick={() => toggleView(viewMode === 'grid' ? 'calendar' : 'grid')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all"
            style={{
              background: viewMode === 'calendar' ? 'transparent' : 'var(--card)',
              borderColor: viewMode === 'calendar' ? '#4f46e5' : 'var(--border)',
              color: viewMode === 'calendar' ? '#4f46e5' : 'var(--muted-foreground)',
            }}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">{viewMode === 'calendar' ? 'Grid View' : 'Calendar'}</span>
          </button>
          <button
            onClick={() => { setEditingSub(null); setIsModalOpen(true) }}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium transition-all hover:opacity-90 shadow-sm"
            style={{ background: 'var(--ap-accent)' }}
          >
            + Add Sub
          </button>
        </div>
      </div>

      {/* ── Summary Banner ── */}
      <div
        className="flex flex-col sm:flex-row items-center justify-between mb-5 rounded-xl p-4 sm:px-6 shadow-sm dark:shadow-none border text-center sm:text-left gap-4 sm:gap-0 shrink-0"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          borderLeft: budgetStatus !== 'none' && budgetStatus !== 'ok' ? `3px solid ${bannerBorderColor}` : `1px solid var(--border)`,
        }}
      >
        {/* Total Spend */}
        <div className="flex-1 flex flex-col items-center cursor-default rounded-lg px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Total Monthly Spend</p>
          <p className="text-xl font-bold" style={{ color: spendColor }}>{spendText}</p>
          {usedConversion && <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>(converted @ {usdRate} PHP/USD)</p>}
          {warningText && <p className="text-[11px] font-semibold mt-0.5" style={{ color: warningText.color }}>{warningText.text}</p>}
        </div>

        <div className="hidden sm:block w-px h-10" style={{ background: 'var(--border)' }} />

        {/* Active Subs */}
        <div className="flex-1 flex flex-col items-center cursor-default rounded-lg px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Active Subscriptions</p>
          <p className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{activeSubsList.length}</p>
        </div>

        <div className="hidden sm:block w-px h-10" style={{ background: 'var(--border)' }} />

        {/* Due This Week */}
        <div className="flex-1 flex flex-col items-center cursor-default rounded-lg px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Due This Week</p>
          <p className="text-xl font-bold" style={{ color: dueThisWeekCount > 0 ? '#f59e0b' : '#22c55e' }}>{dueThisWeekCount}</p>
        </div>

        <div className="hidden sm:block w-px h-10" style={{ background: 'var(--border)' }} />

        {/* Monthly Budget */}
        <div className="flex-1 flex flex-col items-center cursor-default rounded-lg px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--muted-foreground)' }}>Monthly Budget</p>
          {editingBudget ? (
            <InlineEdit
              value={budgetLimit || ''}
              onSave={saveBudget}
              onCancel={() => setEditingBudget(false)}
              placeholder="e.g. 5000"
              prefix="PHP"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              {budgetLimit ? (
                <p className="text-xl font-bold" style={{ color: budgetColor }}>
                  PHP {budgetLimit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                </p>
              ) : (
                <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>Not set</p>
              )}
              <button onClick={() => setEditingBudget(true)} className="transition-colors hover:opacity-80 p-0.5 rounded" style={{ color: 'var(--muted-foreground)' }}>
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          {/* USD Rate edit */}
          {usedConversion && !editingRate && (
            <button onClick={() => setEditingRate(true)} className="text-[10px] mt-0.5 hover:underline" style={{ color: 'var(--muted-foreground)' }}>
              Rate: {usdRate} PHP/USD ✎
            </button>
          )}
          {editingRate && (
            <InlineEdit
              value={usdRate}
              onSave={saveRate}
              onCancel={() => setEditingRate(false)}
              placeholder="56"
              prefix="Rate:"
            />
          )}
        </div>
      </div>

      {/* ── Filter / Sort Bar ── */}
      <div className="flex items-center gap-3 mb-5 shrink-0">
        {/* Sort Dropdown */}
        <div className="relative shrink-0" ref={sortRef}>
          <button
            onClick={() => setSortOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {currentSortLabel}
            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
          </button>
          {sortOpen && (
            <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border shadow-lg z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => { setSortBy(opt.value); setSortOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                  style={{
                    background: sortBy === opt.value ? '#4f46e5' : 'transparent',
                    color: sortBy === opt.value ? 'white' : 'var(--foreground)',
                  }}
                  onMouseEnter={e => { if (sortBy !== opt.value) e.currentTarget.style.background = 'rgba(79,70,229,0.1)' }}
                  onMouseLeave={e => { if (sortBy !== opt.value) e.currentTarget.style.background = 'transparent' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Chips */}
        <div
          className="flex items-center gap-2 flex-1 min-w-0"
          style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <style>{`.chip-scroll::-webkit-scrollbar { display: none; }`}</style>
          {/* Status chips */}
          {STATUS_CHIPS.map(chip => {
            const active = isFilterActive(chip)
            return (
              <button
                key={chip}
                onClick={() => toggleFilter(chip)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={{
                  background: active ? '#4f46e5' : 'var(--card)',
                  borderColor: active ? 'transparent' : 'var(--border)',
                  color: active ? 'white' : 'var(--muted-foreground)',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            )
          })}
          {/* Divider */}
          {uniqueCategories.length > 0 && (
            <div className="shrink-0 w-px h-5" style={{ background: 'var(--border)' }} />
          )}
          {/* Category chips */}
          {uniqueCategories.map(cat => {
            const active = isFilterActive(cat)
            const color = CATEGORY_COLORS[cat] || '#2563eb'
            return (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={{
                  background: active ? color : 'var(--card)',
                  borderColor: active ? 'transparent' : 'var(--border)',
                  color: active ? 'white' : 'var(--muted-foreground)',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content Layout ── */}
      <div className={`transition-all duration-700 flex flex-col lg:flex-row items-start gap-5 flex-1 min-h-0 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

        {/* Left Side: Card Grid or Calendar */}
        {viewMode === 'calendar' ? (
          <SubscriptionCalendar subs={filteredSubs} />
        ) : (
          <div className="flex-1 w-full min-w-0">
            {filteredSubs.length === 0 ? (
              <div className="rounded-2xl border flex flex-col items-center justify-center py-20 px-4 text-center"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <Filter className="w-10 h-10 mb-3 opacity-25" style={{ color: 'var(--foreground)' }} />
                <p className="font-semibold text-base" style={{ color: 'var(--muted-foreground)' }}>
                  {subs.length === 0 ? 'No subscriptions yet' : 'No subscriptions match your filters'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
                  {subs.length === 0 ? 'Add your first subscription to get started.' : 'Try adjusting or clearing your filters'}
                </p>
                {subs.length > 0 && filtersActive ? (
                  <button
                    onClick={() => { setActiveFilters(['All']); setSearchQuery('') }}
                    className="mt-4 px-4 py-1.5 rounded-lg border text-sm font-semibold transition-all hover:opacity-80"
                    style={{ borderColor: '#4f46e5', color: '#4f46e5' }}
                  >
                    Clear Filters
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditingSub(null); setIsModalOpen(true) }}
                    className="mt-4 text-sm hover:underline"
                    style={{ color: 'var(--ap-accent)' }}
                  >
                    Add a new subscription →
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredSubs.map(sub => {
                  const days = daysUntil(sub.next_billing_date)
                  const initial = sub.service_name[0]?.toUpperCase() || '?'
                  const isPaused = !!sub.paused_at
                  const catColor = sub.category ? (CATEGORY_COLORS[sub.category] || '#2563eb') : '#2563eb'

                  let cycleDays = 30
                  const interval = sub.billing_interval || 'monthly'
                  if (interval === 'quarterly') cycleDays = 90
                  else if (interval === 'annually') cycleDays = 365
                  else if (interval === 'custom' && sub.custom_interval_days) cycleDays = parseInt(sub.custom_interval_days)

                  const nextBill = sub.next_billing_date ? new Date(sub.next_billing_date) : null
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const daysLeft = nextBill ? Math.ceil((nextBill - today) / 86400000) : null
                  const daysElapsed = daysLeft !== null ? cycleDays - daysLeft : null
                  const progressPct = daysElapsed !== null ? Math.max(0, Math.min(100, (daysElapsed / cycleDays) * 100)) : 0

                  const isOverdue = daysLeft !== null && daysLeft < 0
                  const isDueToday = daysLeft === 0
                  const isDue3d = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
                  const isDue7d = daysLeft !== null && daysLeft > 3 && daysLeft <= 7

                  let barColor = catColor, barGlow = `0 0 6px ${catColor}66`, barPulse = false
                  if (isPaused) { barColor = 'rgba(128,128,128,0.5)'; barGlow = 'none' }
                  else if (isOverdue || isDueToday || isDue3d) { barColor = '#ef4444'; barGlow = '0 0 8px rgba(239,68,68,0.6)'; barPulse = true }
                  else if (isDue7d) { barColor = '#f59e0b'; barGlow = '0 0 6px rgba(245,158,11,0.5)' }

                  const barPct = (isOverdue || isDueToday) ? 100 : progressPct
                  let statusBadge = { label: 'Active', bg: `${catColor}22`, text: catColor }
                  if (isPaused) statusBadge = { label: 'Paused', bg: 'color-mix(in srgb,#f59e0b 20%,transparent)', text: '#f59e0b' }
                  else if (isDue3d || isDueToday || isOverdue) statusBadge = { label: 'Due Soon', bg: 'color-mix(in srgb,#ef4444 20%,transparent)', text: '#ef4444' }
                  else if (isDue7d) statusBadge = { label: 'Due Soon', bg: 'color-mix(in srgb,#f59e0b 20%,transparent)', text: '#f59e0b' }

                  const cycleBadge = !isPaused && sub.billing_interval === 'quarterly'
                    ? { label: 'Quarterly', bg: 'color-mix(in srgb,#06b6d4 15%,transparent)', text: '#06b6d4' }
                    : !isPaused && sub.billing_interval === 'annually'
                    ? { label: 'Annual', bg: 'color-mix(in srgb,#2563eb 15%,transparent)', text: '#2563eb' }
                    : null

                  let cycleLabel = '/ mo'
                  if (sub.billing_interval === 'quarterly') cycleLabel = '/ qtr'
                  else if (sub.billing_interval === 'annually') cycleLabel = '/ yr'
                  else if (sub.billing_interval === 'custom') cycleLabel = `/ ${sub.custom_interval_days}d`

                  const tooltipText = daysLeft !== null
                    ? `${Math.max(0, daysElapsed)}d of ${cycleDays}d elapsed · ${daysLeft > 0 ? daysLeft + 'd until next bill' : isOverdue ? 'Overdue by ' + Math.abs(daysLeft) + 'd' : 'Due today'}`
                    : 'No billing date set'

                  return (
                    <div key={sub.id}
                      className="rounded-2xl border flex flex-col transition-all duration-300 relative group overflow-hidden"
                      style={{
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderTop: `3px solid ${catColor}`,
                        padding: '1.25rem 1.5rem 1.5rem',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 25px -5px color-mix(in srgb, var(--ap-accent2) 20%, transparent)` }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                    >
                      {/* Top Row */}
                      <div className="flex items-center justify-between mb-6">
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
                                onClick={() => { setEditingSub(sub); setIsModalOpen(true) }}
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
                            onEdit={() => { setEditingSub(sub); setIsModalOpen(true) }}
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
                            {sub.currency} {parseFloat(sub.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs ml-1 font-medium" style={{ color: 'var(--muted-foreground)' }}>{cycleLabel}</span>
                        </div>
                        <span className="text-xs font-semibold pb-1" style={{ color: barColor }}>
                          {daysLeft !== null ? (isOverdue ? 'Overdue' : isDueToday ? 'Due today' : `${daysLeft}d left`) : '—'}
                        </span>
                      </div>

                      <ProgressBar pct={barPct} barColor={barColor} barGlow={barGlow} pulse={barPulse} isPaused={isPaused} tooltip={tooltipText} />

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
        )}

        {/* Right Side: Billing History — hidden in calendar view on mobile */}
        <div className={`w-full lg:w-[320px] shrink-0 lg:sticky lg:top-4 rounded-2xl flex flex-col ${viewMode === 'calendar' ? 'hidden lg:flex' : ''}`}
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
                {billingHistory.map((n, idx) => (
                  <div key={n.id} className="flex gap-4 relative group">
                    {idx !== billingHistory.length - 1 && (
                      <div className="absolute left-[11px] top-4 bottom-[-24px] w-px" style={{ background: 'color-mix(in srgb, var(--border) 80%, transparent)' }} />
                    )}
                    <div className="relative z-10 shrink-0 mt-[2px] w-6 h-6 rounded-md border-2 bg-card flex items-center justify-center"
                      style={{ borderColor: getPlatformColor(n.service_name), background: 'var(--card)' }}>
                      {n.icon_url ? (
                        <img src={n.icon_url} alt={n.service_name} className="w-full h-full rounded-sm object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-foreground">{n.service_name[0]?.toUpperCase()}</span>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2"
                        style={{ background: n.statusColor, borderColor: 'var(--card)' }}
                        title={n.status}
                      />
                    </div>
                    <div className="pb-6 min-w-0 flex-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: 'var(--foreground)' }}>{n.service_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{formatMonthDay(n.paid_on)}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[11px] font-medium truncate" style={{ color: 'var(--muted-foreground)' }}>{n.channel}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-[13px] font-bold shrink-0" style={{ color: 'var(--foreground)' }}>
                          {n.currency} {parseFloat(n.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <button className="text-muted-foreground hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" title="Download Receipt">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
