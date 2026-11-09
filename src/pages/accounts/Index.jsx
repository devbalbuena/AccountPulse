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
import { resolveUnifiedPlatform, UnifiedPlatformIcon } from '@/lib/platformCategories'
import { getAccountTags } from '@/lib/accountTags'
import { exportAccountsCSV } from '@/lib/dataBackup'
import { recordRotationEvent } from '@/lib/rotationAnalytics'
import { saveOfflineCache, loadOfflineCache } from '@/lib/pwaOfflineCache'
import {
  Search,
  Pencil,
  RotateCcw,
  Eraser,
  MoreVertical,
  Archive,
  Copy,
  Check,
  Clock,
  Plus,
  LayoutGrid,
  List,
  History,
  X,
  ArrowUpDown,
  Tag,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react'

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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Account actions"
        className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg shadow-lg border border-border bg-card overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors text-left text-foreground"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onArchive()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-red-500/10 transition-colors text-left text-red-600"
          >
            <Archive className="w-3.5 h-3.5" /> Archive
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
  const [platformFilter, setPlatformFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'ready' | 'cooldown'
  const [selectedTags, setSelectedTags] = useState([])
  const [sortBy, setSortBy] = useState('soonest')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('ap-accounts-view') || 'grid')
  const [activityOpen, setActivityOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [timerToSetRemaining, setTimerToSetRemaining] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedAccountIds, setSelectedAccountIds] = useState([])
  const [batchTimeOpen, setBatchTimeOpen] = useState(false)

  const now = useNow()
  const { addToast } = useToast()

  function toggleViewMode(mode) {
    setViewMode(mode)
    localStorage.setItem('ap-accounts-view', mode)
  }

  function handleCopyEmail(e, acc) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(acc.email)
    setCopiedId(acc.id)
    addToast({ type: 'success', message: 'Email copied to clipboard' })
    setTimeout(() => setCopiedId(prev => (prev === acc.id ? null : prev)), 1400)
  }

  async function handleSaveRemainingTime({ days, hours, minutes }) {
    if (!timerToSetRemaining) return
    const { timer, account } = timerToSetRemaining
    const nowDate = new Date()
    const nextDue = addDuration(days, hours, minutes, nowDate)

    const { error } = await supabase
      .from('token_timers')
      .update({
        next_due_at: nextDue.toISOString(),
        last_refreshed_at: nowDate.toISOString(),
      })
      .eq('id', timer.id)

    if (error) {
      addToast({ type: 'error', message: `Failed to update timer: ${error.message}` })
      return
    }

    const totalMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000
    addToast({
      type: 'success',
      message: `${timer.model_name || 'Timer'} will be ready in ${formatDuration(totalMs)}`,
    })

    await insertNotif(
      `${account.email} (${timer.model_name || 'Timer'}) remaining time set to ${formatDuration(totalMs)}`
    )
    setTimerToSetRemaining(null)
    load()
  }

  const load = useCallback(async () => {
    try {
      const [{ data: acc, error: accErr }, { data: notifs }] = await Promise.all([
        supabase
          .from('accounts')
          .select('*, token_timers(*)')
          .is('deleted_at', null)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15),
      ])
      if (accErr) throw accErr
      const safeAcc = acc || []
      setAccounts(safeAcc)
      setActivity(notifs || [])
      saveOfflineCache('accounts', safeAcc)
    } catch {
      setAccounts(loadOfflineCache('accounts', []))
    } finally {
      setLoading(false)
      setTimeout(() => setIsLoaded(true), 60)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function insertNotif(message) {
    await supabase.from('notifications').insert({ user_id: user.id, message, is_read: false })
  }

  function handleArchiveClick(acc) {
    setAccountToArchive(acc)
  }

  async function executeArchive() {
    if (!accountToArchive) return
    await supabase
      .from('accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', accountToArchive.id)
    await insertNotif(`${accountToArchive.platform} account archived`)
    setAccountToArchive(null)
    load()
  }

  async function handleDrainedNow(timer, account) {
    if (!timer || !timer.interval_hours) {
      addToast({
        type: 'info',
        message: 'No interval hours configured on this timer (use Clock icon to set time).',
      })
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
          await supabase
            .from('token_timers')
            .update({
              next_due_at: prevNextDueAt,
              last_refreshed_at: prevLastRefreshedAt,
            })
            .eq('id', timer.id)
          addToast({ type: 'info', message: `Restored ${timer.model_name || 'Timer'} previous state` })
          load()
        },
      },
    })

    await insertNotif(
      `${account.email} (${timer.model_name || 'Timer'}) marked as drained (${durationText} cooldown)`
    )
    recordRotationEvent({
      accountId: account.id,
      email: account.email,
      platform: account.platform,
      modelName: timer.model_name || 'Timer',
    })
    load()
  }

  async function executeClearActivity() {
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id)
    if (!error) {
      setActivity([])
      setClearActivityOpen(false)
    }
  }

  async function handleModalSave(email, isEdit) {
    await insertNotif(isEdit ? `${email} account updated` : `${email} account added`)
    load()
  }

  function toggleSelectAccount(id) {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleBatchDrainSelected(targetAccounts = null) {
    const list =
      targetAccounts ||
      accounts.filter(a => selectedAccountIds.includes(a.id))
    if (list.length === 0) return

    const nowDate = new Date()
    let drainedTimersCount = 0

    for (const acc of list) {
      const timers = (acc.token_timers || []).filter(t => !t.deleted_at && (t.interval_hours || 0) > 0)
      for (const timer of timers) {
        const dueMs = timer.next_due_at ? new Date(timer.next_due_at).getTime() : 0
        if (dueMs <= now) {
          const nextDue = new Date(nowDate.getTime() + timer.interval_hours * 3600000)
          await supabase
            .from('token_timers')
            .update({
              last_refreshed_at: nowDate.toISOString(),
              next_due_at: nextDue.toISOString(),
            })
            .eq('id', timer.id)
          drainedTimersCount++
        }
      }
    }

    if (drainedTimersCount === 0) {
      addToast({ type: 'info', message: 'No ready timers with intervals found in selection.' })
      return
    }

    addToast({
      type: 'success',
      message: `Batch drained ${drainedTimersCount} ready timer(s) across ${list.length} account(s)`,
    })
    await insertNotif(`Batch drained ${drainedTimersCount} timer(s) across ${list.length} accounts`)
    load()
  }

  async function handleBatchSaveRemainingTime({ days, hours, minutes }) {
    const list = accounts.filter(a => selectedAccountIds.includes(a.id))
    if (list.length === 0) return
    const nowDate = new Date()
    const nextDue = addDuration(days, hours, minutes, nowDate)
    const timerIds = list.flatMap(a => (a.token_timers || []).filter(t => !t.deleted_at).map(t => t.id))

    if (timerIds.length === 0) {
      addToast({ type: 'info', message: 'Selected accounts have no active timers.' })
      setBatchTimeOpen(false)
      return
    }

    const { error } = await supabase
      .from('token_timers')
      .update({
        next_due_at: nextDue.toISOString(),
        last_refreshed_at: nowDate.toISOString(),
      })
      .in('id', timerIds)

    if (error) {
      addToast({ type: 'error', message: error.message })
      return
    }

    const totalMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000
    addToast({
      type: 'success',
      message: `Set ${formatDuration(totalMs)} remaining time across ${timerIds.length} timer(s)`,
    })
    await insertNotif(`Batch set remaining time (${formatDuration(totalMs)}) for ${list.length} accounts`)
    setBatchTimeOpen(false)
    load()
  }

  async function handleBatchArchiveSelected() {
    if (selectedAccountIds.length === 0) return
    if (!confirm(`Archive ${selectedAccountIds.length} selected account(s)?`)) return

    const { error } = await supabase
      .from('accounts')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', selectedAccountIds)

    if (error) {
      addToast({ type: 'error', message: error.message })
      return
    }

    addToast({
      type: 'success',
      message: `Archived ${selectedAccountIds.length} account(s)`,
    })
    await insertNotif(`Batch archived ${selectedAccountIds.length} accounts`)
    setSelectedAccountIds([])
    setSelectMode(false)
    load()
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

  // Compute counts & unified platform categories
  let allCount = 0
  let readyCount = 0
  let cooldownCount = 0

  const platformSummaryMap = new Map()

  accounts.forEach(a => {
    allCount++
    const { isReady, hasTimers } = evaluateAccountStatus(a, now)
    if (hasTimers !== false) {
      if (isReady) readyCount++
      else cooldownCount++
    }

    const unified = resolveUnifiedPlatform(a.platform, a.type, accounts, a.icon_url)
    const existing = platformSummaryMap.get(unified.key)
    if (existing) {
      existing.count++
      if (hasTimers !== false && isReady) existing.readyCount++
    } else {
      platformSummaryMap.set(unified.key, {
        ...unified,
        count: 1,
        readyCount: hasTimers !== false && isReady ? 1 : 0,
      })
    }
  })

  const unifiedPlatformCategories = Array.from(platformSummaryMap.values())

  // Collect all unique tags across accounts
  const allTagCounts = new Map()
  accounts.forEach(a => {
    getAccountTags(a).forEach(t => {
      allTagCounts.set(t, (allTagCounts.get(t) || 0) + 1)
    })
  })
  const availableTags = Array.from(allTagCounts.entries()).map(([tag, count]) => ({ tag, count }))

  function toggleTagFilter(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const filteredAccounts = accounts
    .filter(acc => {
      const unified = resolveUnifiedPlatform(acc.platform, acc.type, accounts, acc.icon_url)
      const accTags = getAccountTags(acc)
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        acc.email.toLowerCase().includes(q) ||
        unified.name.toLowerCase().includes(q) ||
        unified.category.toLowerCase().includes(q) ||
        accTags.some(t => t.toLowerCase().includes(q.replace(/^#/, '')))
      if (!matchesSearch) return false
      if (platformFilter !== 'All' && unified.key !== platformFilter) return false
      if (selectedTags.length > 0 && !selectedTags.every(st => accTags.includes(st))) return false

      if (statusFilter !== 'all') {
        const { isReady, hasTimers } = evaluateAccountStatus(acc, now)
        if (hasTimers === false) return false
        if (statusFilter === 'ready' && !isReady) return false
        if (statusFilter === 'cooldown' && isReady) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'soonest' || sortBy === 'latest') {
        const aHasTimers = a.token_timers && a.token_timers.some(t => !t.deleted_at)
        const bHasTimers = b.token_timers && b.token_timers.some(t => !t.deleted_at)

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
      if (sortBy === 'recent') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'asc') return a.email.localeCompare(b.email)
      if (sortBy === 'desc') return b.email.localeCompare(a.email)
      return 0
    })

  // Group filtered accounts by unified platform category so logo & name are unified once per section
  const groupedByPlatform = []
  const groupLookup = new Map()
  filteredAccounts.forEach(acc => {
    const unified = resolveUnifiedPlatform(acc.platform, acc.type, accounts, acc.icon_url)
    let grp = groupLookup.get(unified.key)
    if (!grp) {
      grp = { unified, items: [] }
      groupLookup.set(unified.key, grp)
      groupedByPlatform.push(grp)
    }
    grp.items.push(acc)
  })

  return (
    <div className="flex flex-col h-full min-h-0 max-w-7xl mx-auto space-y-4">
      {/* ── Unified Single Toolbar (Icon-Conserving) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Accounts</h1>

          {/* Status Segmented Tabs */}
          <div className="inline-flex p-0.5 rounded-lg border border-border bg-muted/50">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all tabular-nums ${
                statusFilter === 'all'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({allCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ready')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all tabular-nums ${
                statusFilter === 'ready'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Ready ({readyCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('cooldown')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all tabular-nums ${
                statusFilter === 'cooldown'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Cooldown ({cooldownCount})
            </button>
          </div>
        </div>

        {/* Right Controls: Search + Compact Icon Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter email or platform..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* Sort Select */}
          <div className="relative">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              title="Sort accounts"
              className="text-xs rounded-lg pl-7 pr-2.5 py-1.5 border border-border bg-card text-foreground focus:outline-none cursor-pointer"
            >
              <option value="soonest">Soonest Ready</option>
              <option value="latest">Longest Cooldown</option>
              <option value="recent">Newest Added</option>
              <option value="oldest">Oldest First</option>
              <option value="asc">Email (A–Z)</option>
              <option value="desc">Email (Z–A)</option>
            </select>
          </div>

          {/* View Toggle: Cards vs Table (Icon-Only) */}
          <div className="inline-flex p-0.5 rounded-lg border border-border bg-muted/50">
            <button
              type="button"
              onClick={() => toggleViewMode('grid')}
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
              onClick={() => toggleViewMode('table')}
              title="Compact Table View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Batch Multi-Select Mode Toggle (Icon-Only) */}
          <button
            type="button"
            onClick={() => {
              setSelectMode(prev => {
                if (prev) setSelectedAccountIds([])
                return !prev
              })
            }}
            title="Toggle Batch Select Mode"
            className={`p-2 rounded-lg border transition-colors shadow-xs ${
              selectMode || selectedAccountIds.length > 0
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          {/* Activity Drawer Button (Icon-Only) */}
          <button
            type="button"
            onClick={() => setActivityOpen(true)}
            title="Activity Feed"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs relative"
          >
            <History className="w-3.5 h-3.5" />
            {activity.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-1.5 right-1.5" />
            )}
          </button>

          {/* Export Accounts CSV Button (Icon-Only) */}
          <button
            type="button"
            onClick={() => {
              exportAccountsCSV(filteredAccounts)
              addToast({ type: 'success', message: 'Accounts exported to CSV' })
            }}
            title="Export Accounts to CSV"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Archived Accounts Link (Icon-Only) */}
          <Link
            to="/accounts/archived"
            title="Archived Accounts"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs"
          >
            <Archive className="w-3.5 h-3.5" />
          </Link>

          {/* Add Account Button */}
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null)
              setIsModalOpen(true)
            }}
            title="Add Account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* ── Unified AI Platform Category Filter Pills ── */}
      {unifiedPlatformCategories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
          <button
            type="button"
            onClick={() => setPlatformFilter('All')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
              platformFilter === 'All'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            All Categories ({accounts.length})
          </button>
          {unifiedPlatformCategories.map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setPlatformFilter(cat.key === platformFilter ? 'All' : cat.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                platformFilter === cat.key
                  ? 'border-primary bg-primary/10 text-primary shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <UnifiedPlatformIcon
                platform={cat.name}
                type={cat.category}
                allAccounts={accounts}
                iconUrl={cat.iconUrl}
                size="sm"
                className="w-4 h-4 rounded text-[9px]"
              />
              <span>{cat.name}</span>
              <span className="opacity-70 font-mono text-[11px]">({cat.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Custom Account Tags Multi-Filter Bar ── */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground mr-1 shrink-0">
            <Tag className="w-3 h-3" /> Tags:
          </span>
          {availableTags.map(({ tag, count }) => {
            const active = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTagFilter(tag)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all shrink-0 ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>#{tag}</span>
                <span className="opacity-75 text-[10px]">({count})</span>
              </button>
            )
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="text-[11px] font-semibold text-primary hover:underline ml-1 shrink-0"
            >
              Clear tags
            </button>
          )}
        </div>
      )}

      {/* ── Batch / Bulk Actions Bar ── */}
      {(selectMode || selectedAccountIds.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-primary/30 bg-primary/5 shadow-xs shrink-0">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="font-bold text-foreground tabular-nums">
              {selectedAccountIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedAccountIds(filteredAccounts.map(a => a.id))}
              className="font-semibold text-primary hover:underline"
            >
              Select All ({filteredAccounts.length})
            </button>
            {selectedAccountIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAccountIds([])}
                className="font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={selectedAccountIds.length === 0}
              onClick={() => handleBatchDrainSelected()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground disabled:opacity-40 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-primary" />
              <span>Drain All Ready</span>
            </button>
            <button
              type="button"
              disabled={selectedAccountIds.length === 0}
              onClick={() => setBatchTimeOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground disabled:opacity-40 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Set Common Time</span>
            </button>
            <button
              type="button"
              disabled={selectedAccountIds.length === 0}
              onClick={handleBatchArchiveSelected}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100/80 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-40 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Batch Archive</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Full-Width Accounts Content grouped by Unified AI Platform Category ── */}
      <div
        className={`transition-all duration-300 flex-1 min-h-0 space-y-6 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {filteredAccounts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-sm font-semibold text-foreground">No matching accounts</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your filter or add a new account.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingAccount(null)
                setIsModalOpen(true)
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Account
            </button>
          </div>
        ) : (
          groupedByPlatform.map(({ unified, items }) => {
            const groupReadyCount = items.filter(a => {
              const st = evaluateAccountStatus(a, now)
              return st.hasTimers !== false && st.isReady
            }).length

            return (
              <section key={unified.key} className="space-y-3">
                {/* ── Unified Platform Category Header (Unifies AI Logo & Name once for all cards!) ── */}
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border bg-card shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UnifiedPlatformIcon
                      platform={unified.name}
                      type={unified.category}
                      allAccounts={accounts}
                      iconUrl={unified.iconUrl}
                      size="md"
                    />
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <h2 className="text-sm font-bold text-foreground tracking-tight truncate">
                        {unified.name}
                      </h2>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {unified.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {groupReadyCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleBatchDrainSelected(items)}
                        title="Drain all ready timers in this category"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
                      >
                        <RotateCcw className="w-3 h-3 text-primary" />
                        <span className="hidden sm:inline">Drain Group</span>
                      </button>
                    )}
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold border tabular-nums"
                      style={{
                        background: 'var(--ready-bg)',
                        color: 'var(--ready-text)',
                        borderColor: 'var(--ready-border)',
                      }}
                    >
                      {groupReadyCount} / {items.length} Ready
                    </span>
                  </div>
                </div>

                {/* ── MODE A: EMAIL-FIRST CLEAN CARDS (3-Column Full Width) ── */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {items.map(acc => {
                      const accountStatus = evaluateAccountStatus(acc, now)
                      const groups = accountStatus.groups || []
                      const [emailUser, emailDomain] = (acc.email || '').split('@')

                      return (
                        <div
                          key={acc.id}
                          className="rounded-xl border border-border bg-card flex flex-col p-4 transition-all shadow-xs hover:border-border/80"
                        >
                          {/* Card Top Row: Email-First (Full Readable Handle) + Icon Actions */}
                          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {(selectMode || selectedAccountIds.length > 0) && (
                                <button
                                  type="button"
                                  onClick={() => toggleSelectAccount(acc.id)}
                                  className="text-primary shrink-0 mr-0.5"
                                  title="Select account for batch action"
                                >
                                  {selectedAccountIds.includes(acc.id) ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Square className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </button>
                              )}
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  accountStatus.hasTimers === false
                                    ? 'bg-slate-400'
                                    : accountStatus.isReady
                                      ? 'bg-emerald-500'
                                      : 'bg-amber-500'
                                }`}
                                title={accountStatus.isReady ? 'Account ready' : 'Account on cooldown'}
                              />
                              <p
                                className="text-xs sm:text-sm font-bold font-mono text-foreground truncate"
                                title={acc.email}
                              >
                                {emailUser}
                                {emailDomain && (
                                  <span className="text-muted-foreground font-normal">@{emailDomain}</span>
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={e => handleCopyEmail(e, acc)}
                                className="w-6 h-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                                title="Copy email"
                              >
                                {copiedId === acc.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="shrink-0 -mr-1">
                              <CardMenu
                                onEdit={() => {
                                  setEditingAccount(acc)
                                  setIsModalOpen(true)
                                }}
                                onArchive={() => handleArchiveClick(acc)}
                              />
                            </div>
                          </div>

                          {/* Custom Account Tags Row (if any) */}
                          {(() => {
                            const accTags = getAccountTags(acc)
                            if (accTags.length === 0) return null
                            return (
                              <div className="flex flex-wrap gap-1 pt-2">
                                {accTags.map(t => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => toggleTagFilter(t)}
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border transition-colors ${
                                      selectedTags.includes(t)
                                        ? 'border-primary bg-primary/15 text-primary'
                                        : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                                    }`}
                                    title={`Filter by #${t}`}
                                  >
                                    #{t}
                                  </button>
                                ))}
                              </div>
                            )
                          })()}

                          {/* Model Timer Groups (Single Status Badge per Group + Icon-Only Controls) */}
                          {groups.length === 0 ? (
                            <div className="py-3 text-center mt-2 rounded-lg border border-dashed border-border bg-muted/20">
                              <p className="text-xs text-muted-foreground">No timers configured</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-border/60 mt-0.5">
                              {groups.map(group => {
                                const isSingleTimer = group.timers.length === 1
                                const singleTimer = isSingleTimer ? group.timers[0] : null

                                // Case 1: Group has 1 timer -> Single consolidated row (NO double Ready badges!)
                                if (isSingleTimer && singleTimer) {
                                  const modelColor = singleTimer.color || '#2563eb'
                                  const hasInterval = (singleTimer.interval_hours || 0) > 0
                                  const subLabel =
                                    singleTimer.model_name &&
                                    singleTimer.model_name.toLowerCase() !== group.groupName.toLowerCase()
                                      ? singleTimer.model_name
                                      : null

                                  return (
                                    <div
                                      key={group.groupName}
                                      className="py-2.5 first:pt-2.5 last:pb-0.5 flex items-center justify-between gap-2"
                                    >
                                      {/* Left: Dot + Group Name + subtle model version */}
                                      <div className="flex items-center gap-2 min-w-0 pr-1">
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: modelColor }}
                                        />
                                        <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                                          <span className="text-xs font-semibold text-foreground truncate">
                                            {group.groupName}
                                          </span>
                                          {subLabel && (
                                            <span className="text-[11px] text-muted-foreground truncate">
                                              {subLabel}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right: ONE Status/Countdown Chip + Icon-Only Action Buttons */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <CountdownTimer nextDueAt={singleTimer.next_due_at} />

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setTimerToSetRemaining({ timer: singleTimer, account: acc })
                                          }
                                          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                          title="Set custom remaining time"
                                        >
                                          <Clock className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => hasInterval && handleDrainedNow(singleTimer, acc)}
                                          disabled={!hasInterval}
                                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                                            hasInterval
                                              ? 'text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer'
                                              : 'opacity-30 cursor-not-allowed'
                                          }`}
                                          title={
                                            hasInterval
                                              ? 'Mark drained (start cooldown)'
                                              : 'No interval configured'
                                          }
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  )
                                }

                                // Case 2: Group has multiple timers (e.g. 5h + Weekly) -> Group summary badge once, sub-timers without duplicate Ready pills
                                return (
                                  <div key={group.groupName} className="py-2.5 first:pt-2.5 last:pb-0.5">
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                      <span className="text-xs font-semibold text-foreground truncate">
                                        {group.groupName}
                                      </span>
                                      <span
                                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border shrink-0 tabular-nums"
                                        style={
                                          group.isReady
                                            ? {
                                                background: 'var(--ready-bg)',
                                                color: 'var(--ready-text)',
                                                borderColor: 'var(--ready-border)',
                                              }
                                            : {
                                                background: 'var(--cooldown-bg)',
                                                color: 'var(--cooldown-text)',
                                                borderColor: 'var(--cooldown-border)',
                                              }
                                        }
                                      >
                                        {group.isReady ? (
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

                                    <div className="space-y-1 pl-2 border-l-2 border-border/60">
                                      {group.timers.map(timer => {
                                        const modelColor = timer.color || '#2563eb'
                                        const hasInterval = (timer.interval_hours || 0) > 0
                                        const timerDue = timer.next_due_at
                                          ? new Date(timer.next_due_at).getTime()
                                          : 0
                                        const timerCooling = timerDue > now

                                        return (
                                          <div
                                            key={timer.id}
                                            className="flex items-center justify-between text-xs py-0.5 pl-1.5 pr-0.5 rounded hover:bg-muted/40 transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                              <span
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: modelColor }}
                                              />
                                              <span className="truncate text-muted-foreground font-medium text-[11px]">
                                                {timer.model_name || 'Timer'}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              {timerCooling && (
                                                <CountdownTimer nextDueAt={timer.next_due_at} />
                                              )}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setTimerToSetRemaining({ timer, account: acc })
                                                }
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                title="Set remaining time"
                                              >
                                                <Clock className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => hasInterval && handleDrainedNow(timer, acc)}
                                                disabled={!hasInterval}
                                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                                                  hasInterval
                                                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer'
                                                    : 'opacity-30 cursor-not-allowed'
                                                }`}
                                                title="Mark drained (start cooldown)"
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
                ) : (
                  /* ── MODE B: COMPACT TABLE VIEW ── */
                  <div className="rounded-xl border border-border bg-card shadow-xs overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="py-2.5 px-4">Account Email</th>
                          <th className="py-2.5 px-4">Model Quotas &amp; Quick Actions</th>
                          <th className="py-2.5 px-4 text-right w-16">Menu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {items.map(acc => {
                          const accountStatus = evaluateAccountStatus(acc, now)
                          const groups = accountStatus.groups || []
                          return (
                            <tr key={acc.id} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      accountStatus.isReady ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                  />
                                  <span>{acc.email}</span>
                                  <button
                                    type="button"
                                    onClick={e => handleCopyEmail(e, acc)}
                                    className="w-6 h-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    title="Copy email"
                                  >
                                    {copiedId === acc.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  {groups.map(group => {
                                    const primaryTimer = group.timers[0]
                                    const hasInterval = primaryTimer && (primaryTimer.interval_hours || 0) > 0
                                    return (
                                      <div
                                        key={group.groupName}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background"
                                      >
                                        <span className="font-semibold text-foreground">{group.groupName}</span>
                                        {primaryTimer && (
                                          <>
                                            <CountdownTimer nextDueAt={primaryTimer.next_due_at} />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setTimerToSetRemaining({ timer: primaryTimer, account: acc })
                                              }
                                              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                                              title="Set remaining time"
                                            >
                                              <Clock className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => hasInterval && handleDrainedNow(primaryTimer, acc)}
                                              disabled={!hasInterval}
                                              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                                              title="Mark drained (start cooldown)"
                                            >
                                              <RotateCcw className="w-3 h-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="inline-flex justify-end">
                                  <CardMenu
                                    onEdit={() => {
                                      setEditingAccount(acc)
                                      setIsModalOpen(true)
                                    }}
                                    onArchive={() => handleArchiveClick(acc)}
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>

      {/* ── Slide-Over Activity Feed Drawer (Frees 100% Width for Accounts) ── */}
      {activityOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-150"
          onClick={() => setActivityOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border-l border-border h-full flex flex-col shadow-xl animate-in slide-in-from-right duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Activity Feed</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {activity.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setClearActivityOpen(true)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Clear activity history"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActivityOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activity.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.map(n => {
                    const matchingAcc = accounts.find(a => n.message.includes(a.email))
                    return (
                      <div key={n.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border/50">
                        <UnifiedPlatformIcon
                          platform={matchingAcc?.platform || 'Account'}
                          type={matchingAcc?.type || ''}
                          allAccounts={accounts}
                          iconUrl={matchingAcc?.icon_url}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-relaxed text-foreground">{n.message}</p>
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
      )}

      {/* Modals */}
      <AccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        account={editingAccount}
        onSave={email => handleModalSave(email, !!editingAccount)}
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

      <SetRemainingTimeModal
        isOpen={batchTimeOpen}
        onClose={() => setBatchTimeOpen(false)}
        timer={{ model_name: `${selectedAccountIds.length} Selected Account(s)` }}
        onSave={handleBatchSaveRemainingTime}
      />
    </div>
  )
}
