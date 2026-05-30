import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Bell } from 'lucide-react'

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

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Notifications</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{notifications.length} total</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button onClick={markAllRead}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--ap-accent)' }}>
            Mark all as read
          </button>
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
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>You'll be notified when token timers expire</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className="flex items-start justify-between gap-4 px-5 py-4 rounded-2xl border transition-all"
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
              {!n.is_read && (
                <span className="w-2 h-2 rounded-full shrink-0 mt-2"
                  style={{ background: 'var(--ap-accent)' }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
