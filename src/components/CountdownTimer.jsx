import { useNow } from '@/context/TimeContext'

export default function CountdownTimer({ nextDueAt, large = false }) {
  const now = useNow()

  if (!nextDueAt) {
    return (
      <span className={large 
        ? "text-xl font-bold tracking-tight" 
        : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono border bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
      } style={large ? { color: 'var(--muted-foreground)' } : {}}>
        No timer
      </span>
    )
  }

  const due = new Date(nextDueAt).getTime()
  const diff = due - now

  let timeLeft = ''
  let status = 'cooldown'

  if (isNaN(due) || diff <= 0) {
    timeLeft = 'Ready'
    status = 'ready'
  } else {
    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (days > 0) {
      timeLeft = `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      timeLeft = `${hours}h ${minutes}m ${seconds}s`
    } else {
      timeLeft = `${minutes}m ${seconds}s`
    }
  }

  const statusClasses = {
    ready: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    cooldown: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  }

  const dotClasses = {
    ready: '',
    warning: 'bg-amber-500',
    cooldown: 'bg-slate-400',
  }

  const largeClasses = {
    ready: { color: '#10b981' },
    warning: { color: '#f59e0b' },
    cooldown: { color: 'var(--foreground)' }
  }

  return (
    <span 
      className={large 
        ? `inline-flex items-center gap-2 text-[26px] font-bold tracking-tight tabular-nums` 
        : `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${statusClasses[status]}`
      }
      style={large ? largeClasses[status] : {}}
    >
      {status !== 'ready' && (
        <span className={`rounded-full animate-pulse ${dotClasses[status]} ${large ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      )}
      {timeLeft}
    </span>
  )
}
