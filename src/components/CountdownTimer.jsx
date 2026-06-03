import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function CountdownTimer({ nextDueAt, accountId, platform, email, userId, modelName = 'Model', large = false }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [status, setStatus] = useState('ok')
  const lastNotifiedDueAt = useRef(null)

  useEffect(() => {
    if (!nextDueAt) {
      setTimeLeft('No timer')
      setStatus('ok')
      return
    }

    function calculate() {
      const now = new Date()
      const due = new Date(nextDueAt)
      const diff = due - now

      if (diff <= 0) {
        setTimeLeft('Expired')
        setStatus('expired')

        if (accountId && nextDueAt && lastNotifiedDueAt.current !== nextDueAt) {
          lastNotifiedDueAt.current = nextDueAt
          supabase.from('notifications').insert({
            user_id: userId,
            message: `${email} (${modelName}) token has expired`,
            is_read: false
          }).then(() => {}) // silently catch
        }
        return
      }

      const totalSeconds = Math.floor(diff / 1000)
      const days = Math.floor(totalSeconds / 86400)
      const hours = Math.floor((totalSeconds % 86400) / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`)
      }

      const totalHours = diff / 3600000
      if (totalHours < 5) setStatus('warning')
      else setStatus('ok')
    }

    calculate()
    const interval = setInterval(calculate, 1000)
    return () => clearInterval(interval)
  }, [nextDueAt])

  const statusClasses = {
    ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/10',
    warning: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    expired: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900',
  }

  const dotClasses = {
    ok: '',
    warning: 'bg-amber-500',
    expired: 'bg-red-500',
  }

  if (status === 'ok' && !nextDueAt) {
    return (
      <span className={large 
        ? "text-xl font-bold tracking-tight" 
        : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono border bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
      } style={large ? { color: 'var(--muted-foreground)' } : {}}>
        No timer
      </span>
    )
  }

  const largeClasses = {
    ok: { color: 'var(--foreground)' },
    warning: { color: '#f59e0b' },
    expired: { color: '#ef4444' }
  }

  return (
    <span 
      className={large 
        ? `inline-flex items-center gap-2 text-[26px] font-bold tracking-tight tabular-nums` 
        : `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${statusClasses[status]}`
      }
      style={large ? largeClasses[status] : {}}
    >
      {status !== 'ok' && (
        <span className={`rounded-full animate-pulse ${dotClasses[status]} ${large ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      )}
      {timeLeft}
    </span>
  )
}
