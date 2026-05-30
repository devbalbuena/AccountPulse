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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Notifications</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {notifications.length} total
            {unreadCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ background: 'color-mix(in srgb, var(--ap-accent) 15%, transparent)', color: 'var(--ap-accent)' }}>
              {unreadCount} unread
            </span>}
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-muted"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-muted"
              style={{ borderColor: 'var(--border)', color: '#ef4444', borderColor: 'color-mix(in srgb, #ef4444 30%, var(--border))' }}>
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-20 px-4 text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--ap-accent) 10%, transparent)' }}>
            <Bell className="w-6 h-6" style={{ color: 'var(--ap-accent)' }} />
          </div>
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>No notifications yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Activity will appear here as you use the app</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className="flex items-start justify-between gap-4 px-5 py-4 rounded-2xl border transition-all group"
              style={{
                background: n.is_read ? 'var(--card)' : 'color-mix(in srgb, var(--ap-accent) 6%, var(--card))',
                borderColor: n.is_read ? 'var(--border)' : 'color-mix(in srgb, var(--ap-accent) 30%, var(--border))',
                cursor: n.is_read ? 'default' : 'pointer'
              }}
            >
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: n.is_read ? 'var(--muted)' : 'color-mix(in srgb, var(--ap-accent) 15%, transparent)' }}>
                  <Bell className="w-3.5 h-3.5" style={{ color: n.is_read ? 'var(--muted-foreground)' : 'var(--ap-accent)' }} />
                </div>
                <div>
                  <p className="text-sm" style={{
                    color: n.is_read ? 'var(--muted-foreground)' : 'var(--foreground)',
                    fontWeight: n.is_read ? 400 : 500
                  }}>
                    {n.message}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {timeAgo(n.created_at)} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-1">
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ap-accent)' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
