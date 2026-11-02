import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    load()
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    load()
  }

  async function clearAll() {
    if (!confirm('Delete all notifications? This cannot be undone.')) return
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id)
    if (error) {
      console.error('[Clear Notifications] Delete failed:', error)
      alert(`Clear failed: ${error.message}`)
    } else {
      setNotifications([])
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            {notifications.length} total
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted shadow-xs transition-colors">
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-destructive/30 bg-card text-destructive hover:bg-destructive/10 shadow-xs transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 px-4 text-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3 text-muted-foreground">
            <Bell className="w-6 h-6" />
          </div>
          <p className="font-semibold text-sm text-foreground">No notifications yet</p>
          <p className="text-xs mt-1 text-muted-foreground">Activity will appear here as you use the app</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`flex items-start justify-between gap-4 px-4 py-3.5 rounded-xl border transition-colors shadow-xs ${
                n.is_read
                  ? 'bg-card border-border'
                  : 'bg-primary/[0.03] border-primary/30 cursor-pointer hover:bg-primary/[0.06]'
              }`}
            >
              <div className="flex gap-3 items-start">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  n.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                }`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm leading-relaxed ${
                    n.is_read ? 'text-muted-foreground' : 'text-foreground font-medium'
                  }`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeAgo(n.created_at)} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-1">
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
