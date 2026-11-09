import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useToast } from '@/context/ToastContext'
import { useNow } from '@/context/TimeContext'
import { evaluateAccountStatus, formatDuration } from '@/lib/durationUtils'
import { UnifiedPlatformIcon } from '@/lib/platformCategories'
import { recordRotationEvent } from '@/lib/rotationAnalytics'
import { useFocusTrap } from '@/lib/useFocusTrap'
import {
  Search,
  Copy,
  RotateCcw,
  LayoutGrid,
  Users,
  CreditCard,
  BarChart2,
  Settings,
  Archive,
  Sun,
  Moon,
  X,
  Check,
  ArrowRight,
} from 'lucide-react'

export default function CommandPalette({ isOpen, onClose, onDataMutated }) {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const { addToast } = useToast()
  const now = useNow()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState([])
  const [subs, setSubs] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)

  useFocusTrap(dialogRef, isOpen, onClose)

  useEffect(() => {
    if (!isOpen || !user) return
    setQuery('')
    setSelectedIndex(0)
    setTimeout(() => inputRef.current?.focus(), 20)

    Promise.all([
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
    ]).then(([{ data: accData }, { data: subData }]) => {
      setAccounts(accData || [])
      setSubs(subData || [])
    })
  }, [isOpen, user])

  async function handleDrainTimer(timer, acc, e) {
    if (e) e.stopPropagation()
    if (!timer || !timer.interval_hours) {
      addToast({ type: 'info', message: 'No interval configured on this timer.' })
      return
    }
    const nowDate = new Date()
    const cooldownMs = (timer.interval_hours || 0) * 3600000
    const nextDue = new Date(nowDate.getTime() + cooldownMs)

    const { error } = await supabase
      .from('token_timers')
      .update({
        last_refreshed_at: nowDate.toISOString(),
        next_due_at: nextDue.toISOString(),
      })
      .eq('id', timer.id)

    if (error) {
      addToast({ type: 'error', message: error.message })
      return
    }

    const durationText = formatDuration(cooldownMs)
    addToast({
      type: 'success',
      message: `Drained ${acc.email} (${timer.model_name || 'Timer'}) — ready in ${durationText}`,
    })
    await supabase.from('notifications').insert({
      user_id: user.id,
      message: `${acc.email} (${timer.model_name || 'Timer'}) marked as drained (${durationText} cooldown)`,
      is_read: false,
    })
    recordRotationEvent({
      accountId: acc.id,
      email: acc.email,
      platform: acc.platform,
      modelName: timer.model_name || 'Timer',
    })

    if (typeof onDataMutated === 'function') onDataMutated()
    onClose()
  }

  function handleCopyEmail(acc) {
    navigator.clipboard.writeText(acc.email)
    addToast({ type: 'success', message: `Copied ${acc.email} to clipboard` })
    onClose()
  }

  const commandItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = []

    // 1. Accounts (Copy email + quick drain ready timers)
    accounts.forEach(acc => {
      const status = evaluateAccountStatus(acc, now)
      const groups = status.groups || []
      const matchText = `${acc.email} ${acc.platform} ${acc.type} ${groups.map(g => g.groupName).join(' ')}`.toLowerCase()
      if (!q || matchText.includes(q)) {
        list.push({
          id: `acc-copy-${acc.id}`,
          section: 'Accounts',
          title: acc.email,
          subtitle: `${acc.platform} · ${status.isReady ? 'Ready now' : 'On cooldown'}`,
          isReady: status.isReady,
          account: acc,
          groups,
          actionLabel: 'Copy Email',
          onSelect: () => handleCopyEmail(acc),
        })
      }
    })

    // 2. Subscriptions
    subs.forEach(sub => {
      const matchText = `${sub.service_name} ${sub.category || ''} ${sub.currency}`.toLowerCase()
      if (!q || matchText.includes(q)) {
        list.push({
          id: `sub-${sub.id}`,
          section: 'Subscriptions',
          title: sub.service_name,
          subtitle: `${sub.currency} ${parseFloat(sub.amount).toFixed(2)} / ${sub.billing_interval || 'mo'}`,
          actionLabel: 'View Subscriptions',
          onSelect: () => {
            navigate('/subscriptions')
            onClose()
          },
        })
      }
    })

    // 3. Quick Navigation & System Actions
    const navActions = [
      { id: 'nav-dashboard', title: 'Go to Dashboard', subtitle: 'Overview & ready accounts', icon: LayoutGrid, path: '/dashboard' },
      { id: 'nav-accounts', title: 'Go to Accounts', subtitle: 'Manage AI accounts & cooldown timers', icon: Users, path: '/accounts' },
      { id: 'nav-subs', title: 'Go to Subscriptions', subtitle: 'Recurring bills, calendar & converter', icon: CreditCard, path: '/subscriptions' },
      { id: 'nav-reports', title: 'Go to Reports & Analytics', subtitle: 'Spend run rate & rotation analytics', icon: BarChart2, path: '/reports' },
      { id: 'nav-archived', title: 'Go to Archived Suite', subtitle: 'Restore or purge archived items', icon: Archive, path: '/accounts/archived' },
      { id: 'nav-settings', title: 'Go to Settings', subtitle: 'Notifications, webhooks, presets & backup', icon: Settings, path: '/settings' },
    ]

    navActions.forEach(na => {
      if (!q || na.title.toLowerCase().includes(q) || na.subtitle.toLowerCase().includes(q)) {
        list.push({
          id: na.id,
          section: 'Navigation',
          title: na.title,
          subtitle: na.subtitle,
          icon: na.icon,
          actionLabel: 'Open',
          onSelect: () => {
            navigate(na.path)
            onClose()
          },
        })
      }
    })

    if (!q || 'toggle theme dark light mode'.includes(q)) {
      list.push({
        id: 'act-theme',
        section: 'Quick Actions',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle Crisp White / Dark appearance',
        icon: theme === 'dark' ? Sun : Moon,
        actionLabel: 'Toggle',
        onSelect: () => {
          toggle()
          onClose()
        },
      })
    }

    return list
  }, [query, accounts, subs, now, theme, navigate, onClose, toggle])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (commandItems.length > 0 ? (i + 1) % commandItems.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (commandItems.length > 0 ? (i - 1 + commandItems.length) % commandItems.length : 0))
      } else if (e.key === 'Enter' && commandItems[selectedIndex]) {
        e.preventDefault()
        commandItems[selectedIndex].onSelect()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, commandItems, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[10vh] px-4 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Command Palette"
        className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search accounts to copy email, trigger Drain, or jump to page..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground bg-muted rounded border border-border">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {commandItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No matching accounts, subscriptions, or commands found.
            </div>
          ) : (
            commandItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const Icon = item.icon
              const acc = item.account

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.onSelect}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                    isSelected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {acc ? (
                      <UnifiedPlatformIcon
                        platform={acc.platform}
                        type={acc.type}
                        allAccounts={accounts}
                        iconUrl={acc.icon_url}
                        size="sm"
                      />
                    ) : Icon ? (
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                        SUB
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">{item.title}</p>
                        {acc && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              item.isReady ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>

                  {/* Quick Drain Buttons for Account Timers + Default Action */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {acc &&
                      item.groups &&
                      item.groups.map(grp => {
                        const primaryTimer = grp.timers[0]
                        if (!primaryTimer || !primaryTimer.interval_hours) return null
                        return (
                          <button
                            key={grp.groupName}
                            type="button"
                            onClick={e => handleDrainTimer(primaryTimer, acc, e)}
                            title={`Drain ${grp.groupName} (${primaryTimer.interval_hours}h cooldown)`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-[10px] font-semibold text-foreground transition-colors"
                          >
                            <RotateCcw className="w-2.5 h-2.5 text-primary" />
                            <span>Drain {grp.groupName}</span>
                          </button>
                        )
                      })}

                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-primary bg-primary/10">
                      {acc ? <Copy className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                      <span>{item.actionLabel}</span>
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-foreground">↑↓</strong> Navigate
            </span>
            <span>
              <strong className="text-foreground">↵</strong> Copy / Execute
            </span>
          </div>
          <span>Click &ldquo;Drain&rdquo; on any account row to start cooldown immediately</span>
        </div>
      </div>
    </div>
  )
}
