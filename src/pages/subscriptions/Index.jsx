import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import SubscriptionModal from '@/components/SubscriptionModal'
import SensitiveActionModal from '@/components/SensitiveActionModal'
import { exportSubscriptionsCSV } from '@/lib/dataBackup'
import { saveOfflineCache, loadOfflineCache } from '@/lib/pwaOfflineCache'
import {
  SUPPORTED_CURRENCIES,
  getSavedRates,
  refreshLiveExchangeRates,
  convertAmount,
  getPreferredDisplayCurrency,
  setPreferredDisplayCurrency,
  getRenewalReminderDays,
  setRenewalReminderDays,
} from '@/lib/currencyConverter'
import {
  Search,
  MoreVertical,
  Pencil,
  Archive,
  History,
  Download,
  CreditCard,
  Copy,
  Check,
  PauseCircle,
  PlayCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Plus,
  LayoutGrid,
  List,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react'

export const CATEGORY_COLORS = {
  'Entertainment': '#ec4899',
  'Productivity': '#3b82f6',
  'Storage': '#06b6d4',
  'Dev Tools': '#8b5cf6',
  'Design': '#f97316',
  'Security': '#ef4444',
  'Finance': '#10b981',
  'Health': '#14b8a6',
  'Education': '#f59e0b',
  'Other': '#64748b',
}

const PALETTE = ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6']
function getPlatformColor(name = '') {
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

// ─── Clean Progress Bar ───
function ProgressBar({ pct, barColor, isPaused, tooltip }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative my-2.5">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-full h-1.5 rounded-full bg-muted cursor-default relative overflow-hidden"
      >
        <div
          style={{
            height: '100%',
            borderRadius: '9999px',
            width: `${Math.max(0, Math.min(100, pct))}%`,
            background: isPaused ? 'var(--muted-foreground)' : barColor,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      {show && tooltip && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover border border-border text-popover-foreground text-[11px] px-2.5 py-1 rounded-md shadow-md whitespace-nowrap z-30 pointer-events-none">
          {tooltip}
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
    setTimeout(() => { setCopied(false); setOpen(false) }, 1400)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-lg border border-border bg-card overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100 text-xs">
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit Details
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onTogglePause(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted transition-colors text-left"
          >
            {isPaused ? <PlayCircle className="w-3.5 h-3.5 text-emerald-600" /> : <PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted transition-colors text-left"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            Copy Name
          </button>
          <div className="h-px bg-border my-1" />
          <button
            type="button"
            onClick={() => { setOpen(false); onArchive(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-500/10 transition-colors text-left"
          >
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Inline Edit Field for Budget ───
function InlineEdit({ value, onSave, onCancel, placeholder, prefix = '' }) {
  const [val, setVal] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKey(e) {
    if (e.key === 'Enter') onSave(val)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input
        ref={inputRef}
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => onSave(val)}
        placeholder={placeholder}
        className="w-24 px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onSave(val) }}
        className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onCancel() }}
        className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
      >
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
  const startPad = (firstDay.getDay() + 6) % 7 // Monday = 0
  const daysInMonth = lastDay.getDate()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

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

  const cells = []
  for (let i = 0; i < startPad; i++) {
    const prevDay = new Date(year, month, -startPad + i + 1)
    cells.push({ date: prevDay, isCurrentMonth: false, dayNum: prevDay.getDate() })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true, dayNum: d })
  }
  const remaining = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, dayNum: i })
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function goBack() { setCurrentDate(new Date(year, month - 1, 1)); setPopoverDay(null) }
  function goForward() { setCurrentDate(new Date(year, month + 1, 1)); setPopoverDay(null) }

  const legendSubs = subs
    .filter(s => {
      if (!s.next_billing_date) return false
      const d = new Date(s.next_billing_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date))

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <h3 className="text-sm font-bold text-foreground">{monthName}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goBack}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goForward}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {weekdays.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const isToday =
              cell.isCurrentMonth &&
              cell.date.getFullYear() === today.getFullYear() &&
              cell.date.getMonth() === today.getMonth() &&
              cell.date.getDate() === today.getDate()
            const daySubs = cell.isCurrentMonth ? (subsByDay[cell.dayNum] || []) : []
            const visible = daySubs.slice(0, 2)
            const hasMore = daySubs.length > 2

            return (
              <div
                key={idx}
                onClick={() => daySubs.length > 0 ? setPopoverDay(cell.dayNum === popoverDay ? null : cell.dayNum) : null}
                className="border-r border-b border-border p-1.5 relative transition-colors"
                style={{
                  minHeight: '76px',
                  cursor: daySubs.length > 0 ? 'pointer' : 'default',
                  background: daySubs.length > 0 ? 'color-mix(in srgb, var(--primary) 3%, var(--card))' : 'transparent',
                }}
              >
                <div className="flex justify-end mb-1">
                  <span
                    className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full tabular-nums ${
                      isToday
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : cell.isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/40'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  {visible.map(sub => {
                    const color = CATEGORY_COLORS[sub.category] || '#2563eb'
                    return (
                      <div
                        key={sub.id}
                        className="truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border"
                        style={{
                          background: `color-mix(in srgb, ${color} 12%, transparent)`,
                          color,
                          borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
                        }}
                      >
                        {sub.service_name}
                      </div>
                    )
                  })}
                  {hasMore && (
                    <div className="text-[9px] font-bold px-1 text-muted-foreground">
                      +{daySubs.length - 2} more
                    </div>
                  )}
                </div>

                {/* Popover */}
                {popoverDay === cell.dayNum && cell.isCurrentMonth && (
                  <div
                    ref={popoverRef}
                    className="absolute z-50 left-0 top-full mt-1 w-64 rounded-xl shadow-xl border border-border bg-card p-3 animate-in fade-in zoom-in-95 duration-100"
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="text-xs font-bold text-foreground mb-2">
                      Due {new Date(year, month, cell.dayNum).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <div className="space-y-1.5">
                      {daySubs.map(sub => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-foreground truncate">{sub.service_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{sub.payment_method || 'Card'}</p>
                          </div>
                          <span className="font-bold text-foreground tabular-nums shrink-0">
                            {sub.currency} {parseFloat(sub.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
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
        <div className="flex flex-wrap items-center gap-3 px-1 text-xs">
          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">This Month:</span>
          {legendSubs.map(sub => {
            const color = CATEGORY_COLORS[sub.category] || '#2563eb'
            return (
              <div key={sub.id} className="flex items-center gap-1.5 text-foreground">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="font-medium">{sub.service_name}</span>
                <span className="text-muted-foreground text-[11px] tabular-nums">({formatMonthDay(sub.next_billing_date)})</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Subscriptions Component ───
export default function SubscriptionsIndex() {
  const { user } = useAuth()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)

  // Status & Category filters
  const [statusFilter, setStatusFilter] = useState('All') // 'All' | 'Due Soon' | 'Paused'
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sortBy, setSortBy] = useState('soonest')

  // Budget
  const [budgetLimit, setBudgetLimit] = useState(() => {
    const v = localStorage.getItem('accountpulse_budget_limit')
    return v ? parseFloat(v) : null
  })
  const [editingBudget, setEditingBudget] = useState(false)

  // View Mode: Cards vs Table vs Calendar (Icon-only toggle)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('ap-sub-view') || 'grid')
  const [subToArchive, setSubToArchive] = useState(null)

  // Multi-Currency Converter & Renewal Reminder Window
  const [rates, setRates] = useState(() => getSavedRates())
  const [displayCurrency, setDisplayCurrency] = useState(() => getPreferredDisplayCurrency('PHP'))
  const [reminderDays, setReminderDays] = useState(() => getRenewalReminderDays())

  useEffect(() => {
    refreshLiveExchangeRates().then(updated => setRates(updated))
  }, [])

  function handleDisplayCurrencyChange(cur) {
    setDisplayCurrency(cur)
    setPreferredDisplayCurrency(cur)
  }

  function handleReminderDaysChange(days) {
    const n = parseInt(days, 10)
    setReminderDays(n)
    setRenewalReminderDays(n)
  }

  function toggleView(mode) {
    setViewMode(mode)
    localStorage.setItem('ap-sub-view', mode)
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .is('deleted_at', null)
      .eq('user_id', user.id)
      .order('next_billing_date', { ascending: true })

    if (error) {
      setSubs(loadOfflineCache('subscriptions', []))
      setLoading(false)
      setTimeout(() => setIsLoaded(true), 60)
      return
    }

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
        saveOfflineCache('subscriptions', updatedData)
      } else {
        setSubs(data)
        saveOfflineCache('subscriptions', data)
      }
    } else {
      setSubs(data || [])
      saveOfflineCache('subscriptions', data || [])
    }
    setLoading(false)
    setTimeout(() => setIsLoaded(true), 60)
  }, [user])

  useEffect(() => { load() }, [load])

  // Realistic billing history based on actual user subscriptions
  useEffect(() => {
    if (subs.length === 0) { setBillingHistory([]); return }
    const history = []
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
          history.push({
            id: `${sub.id}-${i}`,
            service_name: sub.service_name,
            icon_url: sub.icon_url,
            category: sub.category,
            amount: sub.amount,
            currency: sub.currency,
            paid_on: pastDate,
            payment_method: sub.payment_method || 'Default Card',
          })
        }
      }
    })
    history.sort((a, b) => b.paid_on - a.paid_on)
    setBillingHistory(history)
  }, [subs])

  function handleArchiveClick(sub) {
    setSubToArchive(sub)
  }

  async function executeArchive() {
    if (!subToArchive) return
    await supabase.from('subscriptions').update({ deleted_at: new Date().toISOString() }).eq('id', subToArchive.id)
    setSubToArchive(null)
    load()
  }

  async function handleTogglePause(sub) {
    const newVal = sub.paused_at ? null : new Date().toISOString()
    await supabase.from('subscriptions').update({ paused_at: newVal }).eq('id', sub.id)
    load()
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  const activeSubsList = subs.filter(s => !s.paused_at)
  const pausedSubsList = subs.filter(s => !!s.paused_at)
  const dueSoonSubsList = subs.filter(s => {
    const d = daysUntil(s.next_billing_date)
    return d !== null && d >= 0 && d <= reminderDays
  })

  // Total monthly spend calculation converted into unified displayCurrency
  const primaryCurrency = displayCurrency || activeSubsList[0]?.currency || subs[0]?.currency || 'PHP'
  const totalMonthlySpend = activeSubsList.reduce(
    (sum, s) => sum + convertAmount(s.amount || 0, s.currency || 'PHP', primaryCurrency, rates),
    0
  )
  const annualizedSpend = totalMonthlySpend * 12

  // Next renewal
  const sortedByDate = [...activeSubsList].sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date))
  const nextRenewalSub = sortedByDate[0] || null
  const nextRenewalDays = nextRenewalSub ? daysUntil(nextRenewalSub.next_billing_date) : null

  // Budget calculations
  let budgetPct = 0
  if (budgetLimit && budgetLimit > 0) {
    budgetPct = Math.min(100, (totalMonthlySpend / budgetLimit) * 100)
  }

  // Filter list
  const availableCategories = ['All', ...new Set(subs.map(s => s.category).filter(Boolean))]

  const filteredSubs = subs.filter(sub => {
    const matchesSearch = sub.service_name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (statusFilter === 'Due Soon') {
      const d = daysUntil(sub.next_billing_date)
      if (!(d !== null && d >= 0 && d <= reminderDays)) return false
    } else if (statusFilter === 'Paused') {
      if (!sub.paused_at) return false
    }

    if (categoryFilter !== 'All' && sub.category !== categoryFilter) return false

    return true
  }).sort((a, b) => {
    if (sortBy === 'soonest') return new Date(a.next_billing_date) - new Date(b.next_billing_date)
    if (sortBy === 'latest') return new Date(b.next_billing_date) - new Date(a.next_billing_date)
    if (sortBy === 'high') return parseFloat(b.amount) - parseFloat(a.amount)
    if (sortBy === 'low') return parseFloat(a.amount) - parseFloat(b.amount)
    if (sortBy === 'alpha') return a.service_name.localeCompare(b.service_name)
    return 0
  })

  return (
    <div className="flex flex-col h-full min-h-0 max-w-7xl mx-auto space-y-4">
      {/* ── Unified Single Toolbar (Matches Accounts Page) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Subscriptions</h1>

          {/* Status Segmented Tabs */}
          <div className="inline-flex p-0.5 rounded-lg border border-border bg-muted/50">
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all tabular-nums ${
                statusFilter === 'All'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({subs.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Due Soon')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all tabular-nums ${
                statusFilter === 'Due Soon'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600" />
              Due Soon ({dueSoonSubsList.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Paused')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all tabular-nums ${
                statusFilter === 'Paused'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Paused ({pausedSubsList.length})
            </button>
          </div>
        </div>

        {/* Right Toolbar Controls: Search, Sort, View Switcher, History Drawer, Add */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter services..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* Live Currency Converter Switcher */}
          <select
            value={primaryCurrency}
            onChange={e => handleDisplayCurrencyChange(e.target.value)}
            title="Convert all totals into selected currency"
            className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-border bg-card text-foreground focus:outline-none cursor-pointer"
          >
            {SUPPORTED_CURRENCIES.map(cur => (
              <option key={cur} value={cur}>
                {cur} (Convert)
              </option>
            ))}
          </select>

          {/* Renewal Reminder Window Selector (1d / 3d / 7d) */}
          <select
            value={reminderDays}
            onChange={e => handleReminderDaysChange(e.target.value)}
            title="Configure renewal reminder alert threshold"
            className="text-xs rounded-lg px-2.5 py-1.5 border border-border bg-card text-foreground focus:outline-none cursor-pointer"
          >
            <option value={1}>Remind: 1d before</option>
            <option value={3}>Remind: 3d before</option>
            <option value={7}>Remind: 7d before</option>
          </select>

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 border border-border bg-card text-foreground focus:outline-none cursor-pointer"
          >
            <option value="soonest">Due Soonest</option>
            <option value="latest">Due Latest</option>
            <option value="high">Cost (High to Low)</option>
            <option value="low">Cost (Low to High)</option>
            <option value="alpha">Name (A–Z)</option>
          </select>

          {/* View Mode Toggle (Icon-Only: Cards / Table / Calendar) */}
          <div className="inline-flex p-0.5 rounded-lg border border-border bg-muted/50">
            <button
              type="button"
              onClick={() => toggleView('grid')}
              title="Card Grid View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleView('table')}
              title="Compact Table View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleView('calendar')}
              title="Renewal Calendar View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Billing History Drawer Button (Icon-Only) */}
          <button
            type="button"
            onClick={() => setHistoryDrawerOpen(true)}
            title="Billing History"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs relative"
          >
            <History className="w-3.5 h-3.5" />
            {billingHistory.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-1.5 right-1.5" />
            )}
          </button>

          {/* Export Subscriptions CSV Button (Icon-Only) */}
          <button
            type="button"
            onClick={() => exportSubscriptionsCSV(filteredSubs)}
            title="Export Subscriptions to CSV"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Archived Subscriptions Link (Icon-Only) */}
          <Link
            to="/subscriptions/archived"
            title="Archived Subscriptions"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs"
          >
            <Archive className="w-3.5 h-3.5" />
          </Link>

          {/* Add Subscription Button */}
          <button
            type="button"
            onClick={() => {
              setEditingSub(null)
              setIsModalOpen(true)
            }}
            title="Add Subscription"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* ── Category Filter Pills ── */}
      {availableCategories.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
          {availableCategories.map(cat => {
            const isSelected = categoryFilter === cat
            const catColor = cat === 'All' ? 'var(--primary)' : CATEGORY_COLORS[cat] || '#2563eb'
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat !== 'All' && <span className="w-2 h-2 rounded-full" style={{ background: catColor }} />}
                <span>{cat}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Renewal Reminder Alert Banner (1-day / 3-day Configurable Threshold) ── */}
      {dueSoonSubsList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/30 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Renewal Reminder ({reminderDays}d window):</strong>{' '}
              {dueSoonSubsList.map(s => `${s.service_name} (${s.currency} ${parseFloat(s.amount).toFixed(2)})`).join(', ')}{' '}
              due within {reminderDays} {reminderDays === 1 ? 'day' : 'days'}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Due Soon' ? 'All' : 'Due Soon')}
            className="font-bold text-amber-800 dark:text-amber-200 underline shrink-0"
          >
            {statusFilter === 'Due Soon' ? 'Show All' : 'Filter Due Soon'}
          </button>
        </div>
      )}

      {/* ── 3-Card Financial Pulse Strip ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Monthly Recurring & Annualized */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Recurring
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-foreground tabular-nums">
              {activeSubsList.length} Active
            </span>
          </div>

          <div className="my-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
              {primaryCurrency} {totalMonthlySpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-muted-foreground">/mo</span>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Annualized Run Rate</span>
            <strong className="text-foreground tabular-nums">
              {primaryCurrency} {annualizedSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr
            </strong>
          </div>
        </div>

        {/* Card 2: Next Renewal */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Next Renewal
            </span>
            {nextRenewalSub && (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums"
                style={{
                  background: nextRenewalDays <= 3 ? 'var(--cooldown-bg)' : 'var(--ready-bg)',
                  color: nextRenewalDays <= 3 ? 'var(--cooldown-text)' : 'var(--ready-text)',
                  borderColor: nextRenewalDays <= 3 ? 'var(--cooldown-border)' : 'var(--ready-border)',
                }}
              >
                {nextRenewalDays === 0 ? 'Due Today' : `in ${nextRenewalDays}d`}
              </span>
            )}
          </div>

          {nextRenewalSub ? (
            <div className="my-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground truncate">{nextRenewalSub.service_name}</p>
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {nextRenewalSub.currency} {parseFloat(nextRenewalSub.amount).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDateShort(nextRenewalSub.next_billing_date)} &bull; {nextRenewalSub.payment_method || 'Card'}
              </p>
            </div>
          ) : (
            <div className="my-2">
              <p className="text-sm font-semibold text-foreground">No upcoming renewals</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add subscriptions to track billing dates</p>
            </div>
          )}

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{dueSoonSubsList.length} renewals due this week</span>
            <button type="button" onClick={() => toggleView('calendar')} className="font-semibold text-primary hover:underline">
              Calendar →
            </button>
          </div>
        </div>

        {/* Card 3: Monthly Budget Target */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Budget Target
            </span>
            <button
              type="button"
              onClick={() => setEditingBudget(true)}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              {budgetLimit ? 'Edit Limit ✎' : '+ Set Limit'}
            </button>
          </div>

          <div className="my-2">
            {editingBudget ? (
              <InlineEdit
                value={budgetLimit || ''}
                onSave={saveBudget}
                onCancel={() => setEditingBudget(false)}
                placeholder="e.g. 3000"
                prefix={primaryCurrency}
              />
            ) : budgetLimit ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {primaryCurrency} {totalMonthlySpend.toLocaleString()} <span className="font-normal text-muted-foreground">/ {budgetLimit.toLocaleString()}</span>
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${budgetPct >= 100 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {Math.round(budgetPct)}% used
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${budgetPct >= 100 ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground">No budget cap set</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click set limit to track your monthly spending ceiling</p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Spend Ceiling</span>
            <strong className="text-foreground tabular-nums">
              {budgetLimit ? `${primaryCurrency} ${budgetLimit.toLocaleString()}` : 'Unlimited'}
            </strong>
          </div>
        </div>
      </div>

      {/* ── Main Content View (Cards vs Table vs Calendar) ── */}
      <div
        className={`transition-all duration-300 flex-1 min-h-0 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {viewMode === 'calendar' ? (
          <SubscriptionCalendar subs={filteredSubs} />
        ) : filteredSubs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 px-4 text-center">
            <Filter className="w-9 h-9 mb-2.5 opacity-20 text-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {subs.length === 0 ? 'No subscriptions tracked yet' : 'No subscriptions match your filters'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {subs.length === 0
                ? 'Add your subscriptions to monitor monthly costs and renewal dates.'
                : 'Try adjusting your search query or category filters.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingSub(null)
                setIsModalOpen(true)
              }}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Subscription
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── SUB-VIEW 1: CLEAN CARDS ── */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
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

              let barColor = 'var(--primary)'
              if (isPaused) barColor = 'var(--muted-foreground)'
              else if (isOverdue || isDueToday || isDue3d) barColor = '#ef4444'

              let cycleLabel = '/ mo'
              if (sub.billing_interval === 'quarterly') cycleLabel = '/ qtr'
              else if (sub.billing_interval === 'annually') cycleLabel = '/ yr'
              else if (sub.billing_interval === 'custom') cycleLabel = `/ ${sub.custom_interval_days}d`

              const tooltipText = daysLeft !== null
                ? `${Math.max(0, daysElapsed)}d of ${cycleDays}d elapsed · ${daysLeft > 0 ? daysLeft + 'd until next bill' : isOverdue ? 'Overdue' : 'Due today'}`
                : 'No billing date set'

              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between transition-all shadow-xs hover:border-border/80"
                >
                  {/* Top Row: Service Icon & Title */}
                  <div className="flex items-start justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                      {sub.icon_url ? (
                        <img src={sub.icon_url} alt={sub.service_name} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border/60" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-xs"
                          style={{ background: getPlatformColor(sub.service_name) }}
                        >
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold truncate text-xs sm:text-sm text-foreground">{sub.service_name}</p>
                          {isPaused && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200">
                              Paused
                            </span>
                          )}
                        </div>
                        {sub.category ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor }} />
                            <span className="text-[11px] text-muted-foreground">{sub.category}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingSub(sub); setIsModalOpen(true) }}
                            className="text-[11px] text-muted-foreground hover:underline"
                          >
                            + category
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 -mr-1">
                      <CardMenu
                        onEdit={() => { setEditingSub(sub); setIsModalOpen(true) }}
                        onArchive={() => handleArchiveClick(sub)}
                        isPaused={isPaused}
                        onTogglePause={() => handleTogglePause(sub)}
                        serviceName={sub.service_name}
                      />
                    </div>
                  </div>

                  {/* Pricing Row & Progress */}
                  <div className="my-3">
                    <div className="flex items-baseline justify-between mb-1">
                      <div>
                        <span className="text-xl font-extrabold tracking-tight text-foreground tabular-nums">
                          {sub.currency} {parseFloat(sub.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs ml-1 text-muted-foreground">{cycleLabel}</span>
                        {sub.currency && sub.currency.toUpperCase() !== primaryCurrency.toUpperCase() && (
                          <span className="block text-[11px] font-semibold text-primary tabular-nums mt-0.5">
                            &asymp; {primaryCurrency}{' '}
                            {convertAmount(sub.amount, sub.currency, primaryCurrency, rates).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full border ${
                          isOverdue || isDueToday
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                            : daysLeft !== null && daysLeft <= 1
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                              : isDue3d
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-muted/50 text-muted-foreground border-border'
                        }`}
                      >
                        {daysLeft !== null
                          ? isOverdue
                            ? 'Overdue'
                            : isDueToday
                              ? 'Due today'
                              : daysLeft === 1
                                ? 'Due in 1d'
                                : `${daysLeft}d left`
                          : '—'}
                      </span>
                    </div>

                    <ProgressBar pct={progressPct} barColor={barColor} isPaused={isPaused} tooltip={tooltipText} />
                  </div>

                  {/* Card Bottom Row: Billing details + quick action icons */}
                  <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground truncate pr-2">
                      <span>Next: <strong className="text-foreground">{formatDateShort(sub.next_billing_date)}</strong></span>
                      {sub.payment_method && (
                        <>
                          <span>&bull;</span>
                          <CreditCard className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{sub.payment_method}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => { setEditingSub(sub); setIsModalOpen(true) }}
                        title="Edit subscription"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePause(sub)}
                        title={isPaused ? "Resume subscription" : "Pause subscription"}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {isPaused ? <PlayCircle className="w-3.5 h-3.5 text-emerald-600" /> : <PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── SUB-VIEW 2: COMPACT TABLE ── */
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-4">Service</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Next Billing</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubs.map(sub => {
                  const days = daysUntil(sub.next_billing_date)
                  const isPaused = !!sub.paused_at
                  return (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: getPlatformColor(sub.service_name) }}
                          />
                          <span>{sub.service_name}</span>
                          {isPaused && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Paused
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                        {sub.category ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[sub.category] || '#2563eb' }} />
                            <span>{sub.category}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-foreground tabular-nums whitespace-nowrap">
                        {sub.currency} {parseFloat(sub.amount).toFixed(2)} <span className="font-normal text-muted-foreground">/{sub.billing_interval || 'mo'}</span>
                      </td>
                      <td className="py-2.5 px-4 tabular-nums whitespace-nowrap">
                        <span className="text-foreground">{formatDateShort(sub.next_billing_date)}</span>
                        {days !== null && (
                          <span className="text-muted-foreground ml-1.5">
                            ({days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                        {sub.payment_method || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => { setEditingSub(sub); setIsModalOpen(true) }}
                            title="Edit"
                            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePause(sub)}
                            title={isPaused ? "Resume" : "Pause"}
                            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            {isPaused ? <PlayCircle className="w-3.5 h-3.5 text-emerald-600" /> : <PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
                          </button>
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

      {/* ── Slide-Over Billing History Drawer ── */}
      {historyDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-150"
          onClick={() => setHistoryDrawerOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border-l border-border h-full flex flex-col shadow-xl animate-in slide-in-from-right duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Billing History</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {billingHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-muted-foreground">No billing events on record</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {billingHistory.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs"
                          style={{ background: getPlatformColor(item.service_name) }}
                        >
                          {item.service_name[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{item.service_name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatMonthDay(item.paid_on)} &bull; {item.payment_method}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-foreground tabular-nums">
                          {item.currency} {parseFloat(item.amount).toFixed(2)}
                        </span>
                        <div className="flex items-center justify-end gap-1 mt-0.5 text-emerald-600 text-[10px] font-semibold">
                          <Check className="w-3 h-3" /> Paid
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        subscription={editingSub}
        onSave={() => load()}
      />

      {/* Sensitive Action Modal */}
      <SensitiveActionModal
        isOpen={!!subToArchive}
        onClose={() => setSubToArchive(null)}
        title="Archive Subscription"
        description={`Are you sure you want to archive your ${subToArchive?.service_name} subscription? This will stop tracking it in your active budget.`}
        confirmText="Archive"
        confirmPhrase="archive"
        onConfirm={executeArchive}
      />
    </div>
  )
}
