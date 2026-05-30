import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import SubscriptionModal from '@/components/SubscriptionModal'
import { computeNextBillingDate } from '@/lib/subscriptionUtils'
import { Search, MoreVertical, Pencil, Archive, History } from 'lucide-react'

// Reusable color hash for avatars
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

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatMonthDay(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Sub-component for the 3-dot menu on cards
function CardMenu({ onEdit, onArchive }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-muted"
        style={{ color: 'var(--muted-foreground)' }}>
        <MoreVertical className="w-4 h-4" />
      </button>
      
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg shadow-lg border overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <button onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            style={{ color: 'var(--foreground)' }}>
            <Pencil className="w-4 h-4 text-muted-foreground" /> Edit
          </button>
          <button onClick={() => { setOpen(false); onArchive(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-red-500/10 transition-colors text-left"
            style={{ color: '#ef4444' }}>
            <Archive className="w-4 h-4" /> Archive
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
        
        if (nextBillDate < now && sub.billing_day) {
           const newDate = computeNextBillingDate(sub.billing_day)
           if (new Date(newDate) > nextBillDate) {
             updatedData[i] = { ...sub, next_billing_date: newDate }
             supabase.from('subscriptions').update({ next_billing_date: newDate }).eq('id', sub.id).then(() => {})
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
    subs.forEach(sub => {
      const nextDate = new Date(sub.next_billing_date)
      // Generate 3 past months
      for (let i = 1; i <= 3; i++) {
        const pastDate = new Date(nextDate)
        pastDate.setMonth(pastDate.getMonth() - i)
        // Ensure it doesn't land in the future due to day shifts
        if (pastDate < new Date()) {
          history.push({
            id: `${sub.id}-${i}`,
            service_name: sub.service_name,
            icon_url: sub.icon_url,
            amount: sub.amount,
            currency: sub.currency,
            paid_on: pastDate
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

  const totalMonthly = subs.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const filteredSubs = subs.filter(sub => 
    sub.service_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      
      {/* ── Header Section ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Subscriptions</h2>
          {subs.length > 0 && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Total Monthly: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>PHP {totalMonthly.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </p>
          )}
        </div>
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
          <Link to="/subscriptions/archived"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            Archived
          </Link>
          <button onClick={() => { setEditingSub(null); setIsModalOpen(true); }}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium transition-all hover:opacity-90 shadow-sm border border-cyan-400/20"
            style={{ background: 'color-mix(in srgb, var(--ap-accent2) 80%, #000)' }}>
            + Add Subscription
          </button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
              {filteredSubs.map(sub => {
                const days = daysUntil(sub.next_billing_date)
                const initial = sub.service_name[0]?.toUpperCase() || '?'
                
                // Color logic
                const isUrgent = days !== null && days <= 7
                const barColor = isUrgent ? '#f59e0b' : '#22c55e'
                const statusBadge = isUrgent 
                  ? { label: 'Due Soon', bg: 'color-mix(in srgb, #f59e0b 20%, transparent)', text: '#f59e0b' }
                  : { label: 'Active', bg: 'color-mix(in srgb, #22c55e 15%, transparent)', text: '#22c55e' }
                
                // Fake progress percentage assuming ~30 day cycle
                let progressPct = 100
                if (days !== null) {
                  progressPct = Math.max(0, Math.min(100, ((30 - days) / 30) * 100))
                }

                return (
                  <div key={sub.id} 
                    className="rounded-2xl border flex flex-col p-6 transition-all duration-300 relative group overflow-hidden"
                    style={{ 
                      background: 'var(--card)', 
                      borderColor: 'var(--border)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = `0 4px 25px -5px color-mix(in srgb, var(--ap-accent2) 20%, transparent)`
                      e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ap-accent2) 40%, var(--border))'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}>
                    
                    {/* Top Row */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        {sub.icon_url ? (
                          <img src={sub.icon_url} alt={sub.service_name} className="w-10 h-10 rounded-[10px] object-cover shrink-0 border shadow-sm" style={{ borderColor: 'var(--border)' }} />
                        ) : (
                          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 text-white font-bold text-lg shadow-sm" style={{ background: getPlatformColor(sub.service_name) }}>
                            {initial}
                          </div>
                        )}
                        <p className="font-bold truncate text-[16px] tracking-tight" style={{ color: 'var(--foreground)' }}>
                          {sub.service_name}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <CardMenu 
                          onEdit={() => { setEditingSub(sub); setIsModalOpen(true); }}
                          onArchive={() => handleArchive(sub.id)}
                        />
                      </div>
                    </div>

                    {/* Pricing Row */}
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <span className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                          PHP {parseFloat(sub.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                        <span className="text-xs ml-1 font-medium" style={{ color: 'var(--muted-foreground)' }}>/ month</span>
                      </div>
                      <span className="text-xs font-semibold pb-1" style={{ color: barColor }}>
                        {days !== null ? `${days}d left` : '—'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full overflow-hidden mb-6" style={{ background: 'color-mix(in srgb, var(--border) 80%, transparent)' }}>
                      <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${progressPct}%`, background: barColor }} />
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-4 flex items-center justify-between border-t" style={{ borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        Next Bill: <span style={{ color: 'var(--foreground)' }}>{formatDateShort(sub.next_billing_date)}</span>
                      </p>
                      <div className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0"
                        style={{ background: statusBadge.bg, color: statusBadge.text }}>
                        {statusBadge.label}
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Billing History Panel */}
        <div className="w-full lg:w-[280px] shrink-0 sticky top-4 rounded-2xl flex flex-col"
          style={{ background: 'var(--card)', maxHeight: 'calc(100vh - 7rem)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--foreground)' }}>Billing History</h3>
            <History className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {billingHistory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No history available</p>
              </div>
            ) : (
              <div className="relative mt-4">
                {billingHistory.map((n, idx) => {
                  return (
                    <div key={n.id} className="flex gap-4 relative">
                      {/* Timeline Line */}
                      {idx !== billingHistory.length - 1 && (
                        <div className="absolute left-[7px] top-4 bottom-[-16px] w-px" style={{ background: 'color-mix(in srgb, var(--border) 80%, transparent)' }} />
                      )}
                      
                      {/* Node Bullet / Avatar */}
                      <div className="relative z-10 shrink-0 mt-[2px]">
                        {n.icon_url ? (
                          <img src={n.icon_url} alt={n.service_name} className="w-6 h-6 rounded-md object-cover border" style={{ borderColor: 'var(--border)' }} />
                        ) : (
                          <div className="w-6 h-6 rounded-md border-2 bg-card"
                            style={{ 
                              background: 'var(--card)', 
                              borderColor: getPlatformColor(n.service_name)
                            }} 
                          />
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="pb-5 min-w-0">
                        <p className="text-[13px] font-medium leading-snug truncate" style={{ color: 'var(--foreground)' }}>
                          {n.service_name} - {n.currency} {parseFloat(n.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </p>
                        <p className="text-[11px] mt-0.5 font-medium" style={{ color: 'var(--muted-foreground)' }}>
                          paid on {formatMonthDay(n.paid_on)}
                        </p>
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
