import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Bell,
  CheckCheck,
  Trash2,
  Search,
  RotateCcw,
  Users,
  Check,
  Filter,
  X,
} from 'lucide-react'

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function classifyNotification(msg = '') {
  const lower = msg.toLowerCase()
  if (lower.includes('drained') || lower.includes('cooldown') || lower.includes('remaining time') || lower.includes('ready')) {
    return 'drains'
  }
  if (lower.includes('account') || lower.includes('archived') || lower.includes('added') || lower.includes('updated')) {
    return 'accounts'
  }
  return 'system'
}

export default function Notifications() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'unread' | 'drains' | 'accounts'
  const [searchQuery, setSearchQuery] = useState('')

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user])

  async function markAllRead() {
    const prev = notifications
    setNotifications(list => list.map(n => ({ ...n, is_read: true })))
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    if (error) {
      setNotifications(prev)
      addToast({ type: 'error', message: error.message })
    } else {
      addToast({ type: 'success', message: 'All notifications marked as read' })
    }
  }

  async function toggleRead(n, e) {
    if (e) e.stopPropagation()
    const nextRead = !n.is_read
    setNotifications(list =>
      list.map(item => (item.id === n.id ? { ...item, is_read: nextRead } : item))
    )
    await supabase.from('notifications').update({ is_read: nextRead }).eq('id', n.id)
  }

  async function deleteNotification(id, e) {
    if (e) e.stopPropagation()
    const prev = notifications
    setNotifications(list => list.filter(item => item.id !== id))
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) {
      setNotifications(prev)
      addToast({ type: 'error', message: error.message })
    }
  }

  async function clearAll() {
    if (!confirm('Delete all notifications? This cannot be undone.')) return
    const prev = notifications
    setNotifications([])
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id)
    if (error) {
      setNotifications(prev)
      addToast({ type: 'error', message: `Clear failed: ${error.message}` })
    } else {
      addToast({ type: 'info', message: 'Cleared all notifications' })
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  )
  const drainsCount = useMemo(
    () => notifications.filter(n => classifyNotification(n.message) === 'drains').length,
    [notifications]
  )
  const accountsCount = useMemo(
    () => notifications.filter(n => classifyNotification(n.message) === 'accounts').length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (filterTab === 'unread' && n.is_read) return false
      if (filterTab === 'drains' && classifyNotification(n.message) !== 'drains') return false
      if (filterTab === 'accounts' && classifyNotification(n.message) !== 'accounts') return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!(n.message || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [notifications, filterTab, searchQuery])

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

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── Crisp White Header & Batch Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notification Center</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary tabular-nums">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quota cooldown events, batch operations, and account activity log
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card text-foreground hover:bg-muted shadow-xs transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5 text-primary" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-900/50 bg-card text-red-600 hover:bg-red-500/10 shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Filter Tabs & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="inline-flex items-center p-1 rounded-xl border border-border bg-muted/50 text-xs font-medium overflow-x-auto">
          {[
            { id: 'all', label: 'All', count: notifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'drains', label: 'Quota Drains', count: drainsCount },
            { id: 'accounts', label: 'Account Activity', count: accountsCount },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                filterTab === tab.id
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[11px] opacity-70 tabular-nums">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Notification Feed ── */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 px-4 text-center shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-3 text-muted-foreground">
            {notifications.length === 0 ? <Bell className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
          </div>
          <p className="font-semibold text-sm text-foreground">
            {notifications.length === 0 ? 'No notifications yet' : 'No matching notifications'}
          </p>
          <p className="text-xs mt-1 text-muted-foreground">
            {notifications.length === 0
              ? 'Quota cooldown events and account activity will appear here automatically.'
              : 'Try switching filter tabs or clearing your search query.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden shadow-xs">
          {filteredNotifications.map(n => {
            const category = classifyNotification(n.message)
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && toggleRead(n)}
                className={`flex items-start justify-between gap-3 px-4 py-3.5 transition-colors ${
                  n.is_read
                    ? 'bg-card hover:bg-muted/25'
                    : 'bg-primary/[0.03] hover:bg-primary/[0.06] cursor-pointer'
                }`}
              >
                <div className="flex gap-3 items-start min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                      n.is_read
                        ? 'bg-muted/60 text-muted-foreground border-border'
                        : 'bg-primary/10 text-primary border-primary/20'
                    }`}
                  >
                    {category === 'drains' ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : category === 'accounts' ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs sm:text-sm leading-relaxed break-words ${
                        n.is_read ? 'text-muted-foreground' : 'text-foreground font-semibold'
                      }`}
                    >
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                      <span className="font-medium">{timeAgo(n.created_at)}</span>
                      <span>&bull;</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={e => toggleRead(n, e)}
                    title={n.is_read ? 'Mark as unread' : 'Mark as read'}
                    className="w-7 h-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {n.is_read ? (
                      <Check className="w-3.5 h-3.5 opacity-50" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={e => deleteNotification(n.id, e)}
                    title="Delete notification"
                    className="w-7 h-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
