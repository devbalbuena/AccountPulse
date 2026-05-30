import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import CountdownTimer from '@/components/CountdownTimer'
import AccountModal from '@/components/AccountModal'
import { Search, Pencil, Trash2, RotateCw, Eraser } from 'lucide-react'

const PALETTE = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6']
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

export default function AccountsIndex() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  const load = useCallback(async () => {
    const [{ data: acc }, { data: notifs }] = await Promise.all([
      supabase.from('accounts').select('*, token_timers(*)').is('deleted_at', null).eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    ])
    setAccounts(acc || [])
    setActivity(notifs || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function insertNotif(message) {
    await supabase.from('notifications').insert({ user_id: user.id, message, is_read: false })
  }

  async function handleArchive(acc) {
    if (!confirm('Archive this account?')) return
    await supabase.from('accounts').update({ deleted_at: new Date().toISOString() }).eq('id', acc.id)
    await insertNotif(`${acc.platform} account archived`)
    load()
  }

  async function handleMarkRefreshed(timerId, intervalHours, platform, email) {
    const now = new Date()
    const nextDue = new Date(now.getTime() + intervalHours * 3600000)
    await supabase.from('token_timers').update({ last_refreshed_at: now.toISOString(), next_due_at: nextDue.toISOString() }).eq('id', timerId)
    await insertNotif(`${platform} account refreshed`)
    load()
  }

  async function clearActivityFeed() {
    if (!confirm('Clear all activity history?')) return
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id)
    if (error) {
      console.error('[Clear Activity] Delete failed:', error)
      alert(`Clear failed: ${error.message}`)
    } else {
      setActivity([])
    }
  }

  // Called by AccountModal after save - we pass platform + isEdit to generate the right notification
  async function handleModalSave(platform, isEdit) {
    await insertNotif(isEdit ? `${platform} account updated` : `${platform} account added`)
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
  })

  const types = ['All', ...new Set(accounts.map(a => a.type))]

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
          <Link to="/accounts/archived"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            Archived
          </Link>
          <button onClick={() => { setEditingAccount(null); setIsModalOpen(true); }}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium transition-all hover:opacity-90 shadow-sm"
            style={{ background: 'var(--ap-accent)' }}>
            + Add Account
          </button>
        </div>
      </div>

      {/* ── Content Layout ── */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
        
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAccounts.map(acc => {
                const timer = acc.token_timers?.[0]
                const color = getPlatformColor(acc.platform)
                const initial = acc.platform?.[0]?.toUpperCase() || '?'
                
                // Status Badge Logic
                let statusBadge = { label: 'No Timer', bg: 'color-mix(in srgb, var(--muted) 20%, transparent)', text: 'var(--muted-foreground)' }
                let progressPct = 0
                let progColor = 'var(--border)'
                
                if (timer?.next_due_at) {
                  const now = new Date()
                  const due = new Date(timer.next_due_at)
                  const diff = due - now
                  const totalMs = (timer.interval_hours || 0) * 3600000
                  progressPct = totalMs > 0 ? Math.max(0, Math.min(100, (diff / totalMs) * 100)) : 0
                  
                  if (diff <= 0) {
                    statusBadge = { label: 'Expired', bg: 'color-mix(in srgb, #ef4444 20%, transparent)', text: '#ef4444' }
                    progColor = '#ef4444'
                  } else if (diff <= 86400000) { // < 24h
                    statusBadge = { label: 'Expiring', bg: 'color-mix(in srgb, #f59e0b 20%, transparent)', text: '#f59e0b' }
                    progColor = '#f59e0b'
                  } else {
                    statusBadge = { label: 'Active', bg: 'color-mix(in srgb, var(--ap-accent3) 20%, transparent)', text: 'var(--ap-accent3)' }
                    progColor = progressPct > 20 ? 'var(--ap-accent3)' : '#f59e0b'
                  }
                }

                return (
                  <div key={acc.id} 
                    className="rounded-2xl border flex flex-col transition-all duration-300 relative group overflow-hidden"
                    style={{ 
                      background: 'var(--card)', 
                      borderColor: 'var(--border)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = `0 4px 20px -5px color-mix(in srgb, var(--ap-accent) 20%, transparent)`
                      e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ap-accent) 40%, var(--border))'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}>
                    
                    {/* Top Section (Padding 1.5rem = p-6) */}
                    <div className="p-5 flex flex-col">
                      <div className="flex items-start gap-3.5 mb-5">
                        {acc.icon_url ? (
                          <img src={acc.icon_url} alt={acc.platform} className="w-[42px] h-[42px] rounded-[10px] object-cover shrink-0" />
                        ) : (
                          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center shrink-0 text-white font-bold text-lg shadow-sm" style={{ background: color }}>
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-semibold truncate text-[15px] leading-tight" style={{ color: 'var(--foreground)' }}>{acc.platform}</p>
                            <div className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide shrink-0"
                              style={{ background: statusBadge.bg, color: statusBadge.text }}>
                              {statusBadge.label}
                            </div>
                          </div>
                          <p className="text-xs truncate mt-1" style={{ color: 'var(--muted-foreground)' }}>{acc.email}</p>
                          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--muted-foreground)', opacity: 0.8 }}>{acc.type}</p>
                        </div>
                      </div>

                      {/* Middle Section: Timer */}
                      <div className="flex flex-col items-center justify-center mb-4">
                        <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--muted-foreground)' }}>Token Timer</p>
                        <CountdownTimer 
                          nextDueAt={timer?.next_due_at} 
                          accountId={acc.id} platform={acc.platform} email={acc.email} userId={user.id}
                          large
                        />
                      </div>

                      {/* Progress Bar (inside card) */}
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--border) 80%, transparent)' }}>
                        {timer && (
                          <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${progressPct}%`, background: progColor }} />
                        )}
                      </div>
                    </div>

                    {/* Bottom Section (Action Buttons) */}
                    <div className="flex items-center justify-center gap-8 py-3.5 mt-auto" style={{ background: 'color-mix(in srgb, var(--muted) 10%, transparent)' }}>
                      <button onClick={() => handleMarkRefreshed(timer.id, timer.interval_hours, acc.platform, acc.email)}
                        disabled={!timer}
                        className="group/btn relative w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Refresh token">
                        <div className="absolute inset-0 rounded-full scale-0 group-hover/btn:scale-100 transition-transform bg-emerald-500/10 dark:bg-emerald-500/20" />
                        <RotateCw className="w-4 h-4 relative z-10 transition-colors" style={{ color: timer ? 'color-mix(in srgb, var(--ap-accent3) 80%, var(--muted-foreground))' : 'var(--muted-foreground)' }} />
                      </button>

                      <button onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }}
                        className="group/btn relative w-8 h-8 rounded-full flex items-center justify-center transition-all"
                        title="Edit account">
                        <div className="absolute inset-0 rounded-full scale-0 group-hover/btn:scale-100 transition-transform bg-slate-200 dark:bg-slate-800" />
                        <Pencil className="w-4 h-4 relative z-10 transition-colors" style={{ color: 'color-mix(in srgb, var(--foreground) 60%, var(--muted-foreground))' }} />
                      </button>

                      <button onClick={() => handleArchive(acc)}
                        className="group/btn relative w-8 h-8 rounded-full flex items-center justify-center transition-all"
                        title="Archive account">
                        <div className="absolute inset-0 rounded-full scale-0 group-hover/btn:scale-100 transition-transform bg-amber-500/10 dark:bg-amber-500/20" />
                        <Trash2 className="w-4 h-4 relative z-10 transition-colors" style={{ color: '#f59e0b' }} />
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Activity Feed Panel */}
        <div className="w-full lg:w-[280px] shrink-0 sticky top-4 rounded-2xl flex flex-col"
          style={{ background: 'var(--card)', maxHeight: 'calc(100vh - 7rem)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--foreground)' }}>Activity Feed</h3>
            {activity.length > 0 && (
              <button onClick={clearActivityFeed}
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
                  let platName = 'A'
                  const match = n.message.match(/for\s+([^\s]+)\s+account/)
                  if (match) platName = match[1]
                  else if (n.message.includes('account refreshed')) platName = n.message.split(' ')[0]
                  else if (n.message.includes('has expired')) platName = n.message.split(' ')[0]
                  else if (n.message.includes('token renewed')) platName = n.message.split(' ')[0]
                  
                  // Clean up message
                  let displayMsg = n.message
                  if (displayMsg.includes('You refreshed the token for')) {
                     displayMsg = `${platName} account refreshed`
                  }

                  // Retrieve matching account to get icon_url if available
                  const matchingAcc = accounts.find(a => a.platform.toLowerCase() === platName.toLowerCase())
                  const iconUrl = matchingAcc?.icon_url
                  
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
        onSave={(platform) => handleModalSave(platform, !!editingAccount)} 
      />
    </div>
  )
}
