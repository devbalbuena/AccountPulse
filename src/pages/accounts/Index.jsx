import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import CountdownTimer from '@/components/CountdownTimer'
import AccountModal from '@/components/AccountModal'
import SensitiveActionModal from '@/components/SensitiveActionModal'
import { Search, Pencil, Trash2, RotateCw, Eraser, MoreVertical, Archive, Copy, Check } from 'lucide-react'

function CopyButton({ text, tooltip, className }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} title={tooltip} className={`transition-colors hover:text-foreground text-muted-foreground ${className}`}>
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

const PALETTE = ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6']
function getPlatformColor(name) {
  if (!name) return PALETTE[0]
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return PALETTE[sum % PALETTE.length]
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

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

export default function AccountsIndex() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [accountToArchive, setAccountToArchive] = useState(null)
  const [clearActivityOpen, setClearActivityOpen] = useState(false)
  const [filterType, setFilterType] = useState('All')
  const [sortBy, setSortBy] = useState('soonest')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const { addToast } = useToast()

  const load = useCallback(async () => {
    const [{ data: acc }, { data: notifs }] = await Promise.all([
      supabase.from('accounts').select('*, token_timers(*)').is('deleted_at', null).eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    ])
    setAccounts(acc || [])
    setActivity(notifs || [])
    setLoading(false)
    setTimeout(() => setIsLoaded(true), 100)
  }, [user])

  useEffect(() => { load() }, [load])

  async function insertNotif(message) {
    await supabase.from('notifications').insert({ user_id: user.id, message, is_read: false })
  }

  function handleArchiveClick(acc) {
    setAccountToArchive(acc)
  }

  async function executeArchive() {
    if (!accountToArchive) return
    await supabase.from('accounts').update({ deleted_at: new Date().toISOString() }).eq('id', accountToArchive.id)
    await insertNotif(`${accountToArchive.platform} account archived`)
    setAccountToArchive(null)
    load()
  }

  async function handleMarkRefreshed(timerId, intervalHours, email, modelName) {
    const now = new Date()
    const nextDue = new Date(now.getTime() + intervalHours * 3600000)
    await supabase.from('token_timers').update({ last_refreshed_at: now.toISOString(), next_due_at: nextDue.toISOString() }).eq('id', timerId)
    await insertNotif(`${email} (${modelName}) token refreshed`)
    load()
  }

  async function handleBulkRefresh() {
    const expiredTimers = []
    accounts.forEach(a => {
      const t = a.token_timers?.[0]
      if (t && t.next_due_at && new Date(t.next_due_at) <= Date.now()) {
        expiredTimers.push({ ...t, email: a.email })
      }
    })

    if (expiredTimers.length === 0) return

    setLoading(true)
    const now = new Date()

    const updates = expiredTimers.map(t => {
      const nextDue = new Date(now.getTime() + (t.interval_hours || 0) * 3600000)
      return supabase.from('token_timers')
        .update({ 
          last_refreshed_at: now.toISOString(), 
          next_due_at: nextDue.toISOString() 
        })
        .eq('id', t.id)
    })
    
    await Promise.all(updates)
    await insertNotif(`Bulk refresh: ${expiredTimers.length} expired tokens marked as refreshed`)
    
    addToast({
      type: 'success',
      message: `✓ ${expiredTimers.length} tokens refreshed successfully`
    })

    load()
  }

  async function executeClearActivity() {
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id)
    if (error) {
      console.error('[Clear Activity] Delete failed:', error)
    } else {
      setActivity([])
      setClearActivityOpen(false)
    }
  }

  // Called by AccountModal after save - we pass email + isEdit to generate the right notification
  async function handleModalSave(email, isEdit) {
    await insertNotif(isEdit ? `${email} account updated` : `${email} account added`)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          acc.platform.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (filterType !== 'All') return acc.type === filterType
    return true
  }).sort((a, b) => {
    if (sortBy === 'soonest' || sortBy === 'latest') {
      const aTime = a.token_timers?.[0]?.next_due_at ? new Date(a.token_timers[0].next_due_at).getTime() : Infinity
      const bTime = b.token_timers?.[0]?.next_due_at ? new Date(b.token_timers[0].next_due_at).getTime() : Infinity
      if (aTime === bTime) return 0
      return sortBy === 'soonest' ? aTime - bTime : bTime - aTime
    }
    if (sortBy === 'recent') {
      return new Date(b.created_at) - new Date(a.created_at)
    }
    if (sortBy === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at)
    }
    if (sortBy === 'asc') {
      return a.email.localeCompare(b.email)
    }
    if (sortBy === 'desc') {
      return b.email.localeCompare(a.email)
    }
    return 0
  })

  const types = ['All', ...new Set(accounts.map(a => a.type))]
  const expiredCountTotal = accounts.reduce((acc, a) => {
    const t = a.token_timers?.[0]
    return acc + (t && t.next_due_at && new Date(t.next_due_at) <= Date.now() ? 1 : 0)
  }, 0)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Accounts</h2>
        <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1 transition-colors"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 border focus:outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {types.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
          </select>
          <select 
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 border focus:outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="soonest">Sort: Soonest</option>
            <option value="latest">Latest to Expire</option>
            <option value="recent">Recently Added</option>
            <option value="oldest">Oldest First</option>
            <option value="asc">Alphabetical (A-Z)</option>
            <option value="desc">Alphabetical (Z-A)</option>
          </select>
          <Link to="/accounts/archived"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            Archived
          </Link>
          <button onClick={() => { setEditingAccount(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <span className="hidden sm:inline">Add Account</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {expiredCountTotal >= 2 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-[10px] mb-6 animate-in slide-in-from-top-2 fade-in"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
          <p className="text-[#ef4444] font-bold text-sm flex items-center gap-2">
            <span>⚠</span> {expiredCountTotal} expired tokens detected
          </p>
          <button 
            onClick={handleBulkRefresh}
            className="px-4 py-2 rounded-md bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold transition-colors shadow-sm shrink-0"
          >
            Mark All Expired as Refreshed
          </button>
        </div>
      )}

      {/* ── Content Layout ── */}
      <div className={`transition-all duration-700 flex flex-col lg:flex-row items-start gap-5 flex-1 min-h-0 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        
        {/* Left Side: Card Grid */}
        <div className="flex-1 w-full min-w-0">
          {filteredAccounts.length === 0 ? (
            <div className="rounded-2xl border flex flex-col items-center justify-center py-24 px-4 text-center"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <p className="font-medium" style={{ color: 'var(--muted-foreground)' }}>No accounts found</p>
              <button onClick={() => { setEditingAccount(null); setIsModalOpen(true) }}
                className="mt-2 text-sm hover:underline" style={{ color: 'var(--ap-accent)' }}>Add a new account →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAccounts.map(acc => {
                const timers = acc.token_timers?.slice(0, 2) || []
                const color = getPlatformColor(acc.platform)
                const initial = acc.platform?.[0]?.toUpperCase() || '?'

                return (
                  <div key={acc.id} 
                    className="rounded-2xl border flex flex-col p-5 transition-all duration-300 relative group overflow-hidden"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    {/* Top Row with Platform, Subtitle and CardMenu */}
                    <div className="flex items-start justify-between mb-5 group/header">
                      <div className="flex items-start gap-3.5 min-w-0 pr-4">
                        {acc.icon_url ? (
                          <img src={acc.icon_url} alt={acc.platform} className="w-[42px] h-[42px] rounded-[10px] object-cover shrink-0" />
                        ) : (
                          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center shrink-0 text-white font-bold text-lg shadow-sm" style={{ background: color }}>
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-[15px] leading-tight" style={{ color: 'var(--foreground)' }}>{acc.platform}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{acc.email}</p>
                            <CopyButton text={acc.email} tooltip="Copy email" className="opacity-0 group-hover/header:opacity-100" />
                          </div>
                          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--muted-foreground)', opacity: 0.8 }}>{acc.type}</p>
                        </div>
                      </div>
                      <div className="shrink-0 -mr-2 relative top-[-2px]">
                        <CardMenu 
                          onEdit={() => { setEditingAccount(acc); setIsModalOpen(true); }}
                          onArchive={() => handleArchiveClick(acc)}
                        />
                      </div>
                    </div>

                    {/* Stack of Sub-Timers */}
                    <div className="flex flex-col gap-3">
                      {timers.length === 0 && (
                        <p className="text-xs text-center py-4" style={{ color: 'var(--muted-foreground)' }}>No timers configured</p>
                      )}
                      
                      {timers.map(timer => {
                        const modelColor = timer.color || '#2563eb'
                        let progressPct = 0
                        let timerExpired = false
                        let timerExpiring = false

                        if (timer?.next_due_at) {
                          const now = new Date()
                          const due = new Date(timer.next_due_at)
                          const diff = due - now
                          const totalMs = (timer.interval_hours || 0) * 3600000
                          progressPct = totalMs > 0 ? Math.max(0, Math.min(100, (diff / totalMs) * 100)) : 0
                          timerExpired = diff <= 0
                          timerExpiring = !timerExpired && diff <= 86400000
                        }

                        // Progress bar color: use model's own color normally, amber when expiring, red when expired
                        const progColor = timerExpired ? '#ef4444' : timerExpiring ? '#f59e0b' : modelColor

                        return (
                          <div key={timer.id} className="p-3 rounded-xl border flex flex-col gap-2"
                            style={{
                              borderColor: `color-mix(in srgb, ${modelColor} 20%, var(--border))`,
                              background: `color-mix(in srgb, ${modelColor} 5%, var(--muted)/30%)`,
                            }}>
                            <div className="flex items-center justify-between group/model">
                              {/* Model name in its own color */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-xs font-bold truncate pr-2" style={{ color: modelColor }}>
                                  {timer.model_name || 'Model'}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Countdown — colored text */}
                                <span style={{ color: timerExpired ? '#ef4444' : timerExpiring ? '#f59e0b' : modelColor }}>
                                  <CountdownTimer
                                    nextDueAt={timer?.next_due_at}
                                    accountId={acc.id} platform={acc.platform} email={acc.email} userId={user.id} modelName={timer.model_name}
                                    color={progColor}
                                  />
                                </span>
                                {/* Refresh button — colored icon */}
                                <button onClick={() => handleMarkRefreshed(timer.id, timer.interval_hours, acc.email, timer.model_name)}
                                  className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
                                  style={{ color: modelColor }}
                                  onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, ${modelColor} 15%, transparent)` }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  title="Refresh token">
                                  <RotateCw className="w-3 h-3" />
                                </button>
                                
                                <CopyButton text={timer.model_name || 'Model'} tooltip="Copy model name" className="opacity-0 group-hover/model:opacity-100" />
                              </div>
                            </div>

                            {/* Progress Bar in model's color */}
                            <div className="w-full h-1.5 rounded-full overflow-hidden"
                              style={{ background: `color-mix(in srgb, ${modelColor} 15%, var(--border))` }}>
                              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${progressPct}%`, background: progColor }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Activity Feed Panel */}
        <div className="w-full lg:w-[280px] shrink-0 lg:sticky lg:top-4 rounded-2xl flex flex-col"
          style={{ background: 'var(--card)', maxHeight: 'calc(100vh - 7rem)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--foreground)' }}>Activity Feed</h3>
            {activity.length > 0 && (
              <button onClick={() => setClearActivityOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
                style={{ color: 'var(--muted-foreground)' }}
                title="Clear activity history">
                <Eraser className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {activity.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No recent activity</p>
              </div>
            ) : (
              <div className="relative">
                {activity.map((n, idx) => {
                  // Retrieve matching account to get icon_url if available
                  const matchingAcc = accounts.find(a => n.message.includes(a.email))
                  const platName = matchingAcc ? matchingAcc.platform : 'A'
                  const iconUrl = matchingAcc?.icon_url
                  const displayMsg = n.message
                  
                  return (
                    <div key={n.id} className="flex gap-3.5 relative">
                      {/* Timeline Line */}
                      {idx !== activity.length - 1 && (
                        <div className="absolute left-3.5 top-8 bottom-[-8px] w-px" style={{ background: 'var(--border)' }} />
                      )}
                      
                      {/* Avatar */}
                      <div className="relative z-10 shrink-0">
                        {iconUrl ? (
                          <img src={iconUrl} alt={platName} className="w-7 h-7 rounded-[6px] object-cover border" style={{ borderColor: 'var(--border)' }} />
                        ) : (
                          <div className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                            style={{ background: getPlatformColor(platName) }}>
                            {platName[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="pb-6 min-w-0 pt-0.5">
                        <p className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: 'var(--foreground)' }}>{displayMsg}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      <AccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        account={editingAccount} 
        onSave={(email) => handleModalSave(email, !!editingAccount)} 
      />

      <SensitiveActionModal
        isOpen={!!accountToArchive}
        onClose={() => setAccountToArchive(null)}
        title="Archive Account"
        description={`Are you sure you want to archive your ${accountToArchive?.platform} account? This will hide it from the main list.`}
        confirmText="Archive"
        confirmPhrase="archive"
        onConfirm={executeArchive}
      />

      <SensitiveActionModal
        isOpen={clearActivityOpen}
        onClose={() => setClearActivityOpen(false)}
        title="Clear Activity Feed"
        description="Are you sure you want to delete all activity history? This action cannot be undone."
        confirmText="Clear History"
        confirmPhrase="clear"
        onConfirm={executeClearActivity}
      />
    </div>
  )
}
