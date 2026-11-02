import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import CountdownTimer from '@/components/CountdownTimer'
import AccountModal from '@/components/AccountModal'
import SensitiveActionModal from '@/components/SensitiveActionModal'
import SetRemainingTimeModal from '@/components/SetRemainingTimeModal'
import { addDuration, formatDuration, evaluateAccountStatus } from '@/lib/durationUtils'
import { useNow } from '@/context/TimeContext'
import { Search, Pencil, Trash2, RotateCw, RotateCcw, Eraser, MoreVertical, Archive, Copy, Check, Clock } from 'lucide-react'

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
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'ready' | 'cooldown'
  const [sortBy, setSortBy] = useState('soonest')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [timerToSetRemaining, setTimerToSetRemaining] = useState(null)
  const now = useNow()
  const { addToast } = useToast()

  async function handleSaveRemainingTime({ days, hours, minutes }) {
    if (!timerToSetRemaining) return
    const { timer, account } = timerToSetRemaining
    const now = new Date()
    const nextDue = addDuration(days, hours, minutes, now)
    
    const { error } = await supabase.from('token_timers').update({
      next_due_at: nextDue.toISOString(),
      last_refreshed_at: now.toISOString(),
    }).eq('id', timer.id)
    
    if (error) {
      addToast({ type: 'error', message: `Failed to update timer: ${error.message}` })
      return
    }

    const totalMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000
    addToast({
      type: 'success',
      message: `${timer.model_name || 'Timer'} will be ready in ${formatDuration(totalMs)}`
    })

    await insertNotif(`${account.email} (${timer.model_name || 'Timer'}) remaining time set to ${formatDuration(totalMs)}`)
    setTimerToSetRemaining(null)
    load()
  }

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

  async function handleDrainedNow(timer, account) {
    if (!timer || !timer.interval_hours) {
      addToast({ type: 'info', message: 'No interval hours configured on this timer (use Clock to set time).' })
      return
    }
    const now = new Date()
    const cooldownMs = (timer.interval_hours || 0) * 3600000
    const nextDue = new Date(now.getTime() + cooldownMs)
    const prevNextDueAt = timer.next_due_at
    const prevLastRefreshedAt = timer.last_refreshed_at

    const { error } = await supabase.from('token_timers').update({
      last_refreshed_at: now.toISOString(),
      next_due_at: nextDue.toISOString()
    }).eq('id', timer.id)

    if (error) {
      addToast({ type: 'error', message: `Failed to set cooldown: ${error.message}` })
      return
    }

    const durationText = formatDuration(cooldownMs)
    addToast({
      type: 'success',
      message: `${timer.model_name || 'Timer'} will be ready in ${durationText}`,
      action: {
        label: 'Undo',
        onClick: async () => {
          await supabase.from('token_timers').update({
            next_due_at: prevNextDueAt,
            last_refreshed_at: prevLastRefreshedAt
          }).eq('id', timer.id)
          addToast({ type: 'info', message: `Restored ${timer.model_name || 'Timer'} previous state` })
          load()
        }
      }
    })

    await insertNotif(`${account.email} (${timer.model_name || 'Timer'}) marked as drained (${durationText} cooldown)`)
    load()
  }

  // Backwards compatibility for existing callers
  async function handleMarkRefreshed(timerId, intervalHours, email, modelName) {
    return handleDrainedNow({ id: timerId, interval_hours: intervalHours, model_name: modelName }, { email })
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

  let allCount = 0
  let readyCount = 0
  let cooldownCount = 0

  accounts.forEach(a => {
    allCount++
    const { isReady, hasTimers } = evaluateAccountStatus(a, now)
    if (hasTimers !== false) {
      if (isReady) readyCount++
      else cooldownCount++
    }
  })

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          acc.platform.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (filterType !== 'All' && acc.type !== filterType) return false

    if (statusFilter !== 'all') {
      const { isReady, hasTimers } = evaluateAccountStatus(acc, now)
      // Accounts with no timers appear only under "All"
      if (hasTimers === false) return false
      if (statusFilter === 'ready' && !isReady) return false
      if (statusFilter === 'cooldown' && isReady) return false
    }
    return true
  }).sort((a, b) => {
    if (sortBy === 'soonest' || sortBy === 'latest') {
      const aHasTimers = a.token_timers && a.token_timers.some(t => !t.deleted_at)
      const bHasTimers = b.token_timers && b.token_timers.some(t => !t.deleted_at)

      // Accounts with no timers always sort last and maintain stable secondary order
      if (!aHasTimers && !bHasTimers) return a.email.localeCompare(b.email)
      if (!aHasTimers) return 1
      if (!bHasTimers) return -1

      const aStatus = evaluateAccountStatus(a, now)
      const bStatus = evaluateAccountStatus(b, now)
      const aTime = aStatus.isReady ? 0 : aStatus.soonestAvailableMs
      const bTime = bStatus.isReady ? 0 : bStatus.soonestAvailableMs

      if (aTime !== bTime) {
        return sortBy === 'soonest' ? aTime - bTime : bTime - aTime
      }
      return a.email.localeCompare(b.email)
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 shrink-0">
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
            <option value="latest">Latest Cooldown</option>
            <option value="recent">Recently Added</option>
            <option value="oldest">Oldest First</option>
            <option value="asc">Alphabetical (A-Z)</option>
            <option value="desc">Alphabetical (Z-A)</option>
          </select>
          <Link to="/accounts/archived"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground hover:text-foreground shadow-xs">
            Archived
          </Link>
          <button onClick={() => { setEditingAccount(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold shadow-xs transition-colors">
            <span className="hidden sm:inline">Add Account</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* ── Status Tabs (All / Ready now / On cooldown) ── */}
      <div className="flex items-center gap-2 mb-5 shrink-0 overflow-x-auto pb-1">
        <div className="inline-flex p-1 rounded-lg border border-border bg-muted/40">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All <span className="opacity-70 ml-1 font-mono">({allCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ready')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'ready'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Ready now <span className="opacity-70 ml-0.5 font-mono">({readyCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('cooldown')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'cooldown'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            On cooldown <span className="opacity-70 ml-0.5 font-mono">({cooldownCount})</span>
          </button>
        </div>
      </div>

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
                const color = getPlatformColor(acc.platform)
                const initial = acc.platform?.[0]?.toUpperCase() || '?'
                const accountStatus = evaluateAccountStatus(acc, now)
                const groups = accountStatus.groups || []

                return (
                  <div key={acc.id} 
                    className="rounded-xl border border-border bg-card flex flex-col p-5 transition-all shadow-xs hover:border-border/80"
                  >
                    {/* Top Row with Platform, Type, Email + Copy Button, and CardMenu */}
                    <div className="flex items-start justify-between pb-3.5 border-b border-border">
                      <div className="flex items-start gap-3 min-w-0 pr-2">
                        {acc.icon_url ? (
                          <img src={acc.icon_url} alt={acc.platform} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border/60" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-base shadow-xs" style={{ background: color }}>
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate text-sm leading-tight text-foreground">{acc.platform}</p>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{acc.type}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-xs truncate font-mono text-muted-foreground" title={acc.email}>{acc.email}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                navigator.clipboard.writeText(acc.email)
                                addToast({ type: 'success', message: 'Email copied to clipboard' })
                              }}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy email to clipboard"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 -mr-1.5">
                        <CardMenu 
                          onEdit={() => { setEditingAccount(acc); setIsModalOpen(true); }}
                          onArchive={() => handleArchiveClick(acc)}
                        />
                      </div>
                    </div>

                    {/* Stack of Sub-Timer Groups (Clean non-nested layout) */}
                    {groups.length === 0 ? (
                      <div className="py-4 text-center mt-3 rounded-lg border border-dashed border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground">No timers configured</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {groups.map(group => {
                          const isGroupReady = group.isReady

                          return (
                            <div key={group.groupName} className="pt-3 pb-1 first:pt-3">
                              {/* Group Header: Group Name + Quiet Status Chip */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-semibold truncate text-foreground">
                                  {group.groupName}
                                </span>

                                {/* Status Chip: Calm Muted Tones */}
                                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border shrink-0 ${
                                  isGroupReady
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                }`}>
                                  {isGroupReady ? (
                                    <>
                                      <Check className="w-3 h-3 stroke-[2.5]" />
                                      <span>Ready</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3 h-3" />
                                      <span>{group.formatted}</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Individual Timers in this Group */}
                              <div className="space-y-1">
                                {group.timers.map(timer => {
                                  const modelColor = timer.color || '#2563eb'
                                  const hasInterval = (timer.interval_hours || 0) > 0

                                  return (
                                    <div key={timer.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded-md hover:bg-muted/40 transition-colors">
                                      {/* Timer name with model color dot */}
                                      <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <span 
                                          className="w-2 h-2 rounded-full shrink-0" 
                                          style={{ backgroundColor: modelColor }} 
                                          title={`Model color: ${modelColor}`} 
                                        />
                                        <span className="truncate text-muted-foreground font-medium text-xs" title={timer.model_name}>
                                          {timer.model_name || 'Timer'}
                                        </span>
                                      </div>

                                      {/* Actions & Countdown */}
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-xs font-mono tabular-nums text-foreground">
                                          <CountdownTimer
                                            nextDueAt={timer.next_due_at}
                                            accountId={acc.id}
                                            platform={acc.platform}
                                            email={acc.email}
                                            userId={user.id}
                                            modelName={timer.model_name}
                                          />
                                        </span>

                                        {/* Set remaining time button */}
                                        <button 
                                          onClick={() => setTimerToSetRemaining({ timer, account: acc })}
                                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                          title="Set remaining time"
                                        >
                                          <Clock className="w-3 h-3" />
                                        </button>

                                        {/* Drained now (start cooldown) button */}
                                        <button 
                                          onClick={() => hasInterval && handleDrainedNow(timer, acc)}
                                          disabled={!hasInterval}
                                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                            hasInterval 
                                              ? 'text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer' 
                                              : 'opacity-30 cursor-not-allowed'
                                          }`}
                                          title={hasInterval ? "Drained now (start cooldown)" : "Cannot drain: no interval hours configured (use Clock instead)"}
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                        </button>
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
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Activity Feed Panel */}
        <div className="w-full lg:w-[280px] shrink-0 lg:sticky lg:top-4 rounded-xl flex flex-col bg-card border border-border shadow-xs"
          style={{ maxHeight: 'calc(100vh - 7rem)' }}>
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-border bg-card rounded-t-xl">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity Feed</h3>
            {activity.length > 0 && (
              <button onClick={() => setClearActivityOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                title="Clear activity history">
                <Eraser className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activity.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="relative">
                {activity.map((n, idx) => {
                  const matchingAcc = accounts.find(a => n.message.includes(a.email))
                  const platName = matchingAcc ? matchingAcc.platform : 'A'
                  const iconUrl = matchingAcc?.icon_url
                  const displayMsg = n.message
                  
                  return (
                    <div key={n.id} className="flex gap-3 relative pb-4 last:pb-1">
                      {idx !== activity.length - 1 && (
                        <div className="absolute left-3.5 top-6 bottom-0 w-px bg-border" />
                      )}
                      
                      {/* Avatar */}
                      <div className="relative z-10 shrink-0">
                        {iconUrl ? (
                          <img src={iconUrl} alt={platName} className="w-7 h-7 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                            style={{ background: getPlatformColor(platName) }}>
                            {platName[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="min-w-0 pt-0.5">
                        <p className="text-xs font-medium leading-relaxed text-foreground">{displayMsg}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
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

      <SetRemainingTimeModal
        isOpen={!!timerToSetRemaining}
        onClose={() => setTimerToSetRemaining(null)}
        timer={timerToSetRemaining?.timer}
        onSave={handleSaveRemainingTime}
      />
    </div>
  )
}
