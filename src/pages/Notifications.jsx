import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

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

  if (loading) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notifications</h2>
        {notifications.some(n => !n.is_read) && (
          <button onClick={markAllRead}
            className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 px-4 text-center shadow-sm dark:shadow-none">
          <div className="text-5xl mb-4 opacity-10 select-none">🔔</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No notifications yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">You'll be notified when token timers expire</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`
                flex items-start justify-between gap-4 px-5 py-4 rounded-xl border transition-colors
                ${n.is_read
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-default'
                  : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                }
              `}
            >
              <div className="flex gap-3 items-start">
                <span className="text-base mt-0.5">🔔</span>
                <div>
                  <p className={`text-sm ${n.is_read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200 font-medium'}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {!n.is_read && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
