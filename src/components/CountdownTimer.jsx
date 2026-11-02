import { useNow } from '@/context/TimeContext'
import { Check, Clock } from 'lucide-react'

export default function CountdownTimer({ nextDueAt, large = false }) {
  const now = useNow()

  if (!nextDueAt) {
    return (
      <span
        className={
          large
            ? 'text-xl font-bold tracking-tight text-muted-foreground'
            : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium font-mono border border-border bg-muted text-muted-foreground'
        }
      >
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

  if (large) {
    return (
      <span
        className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight tabular-nums"
        style={{ color: status === 'ready' ? 'var(--ready-text)' : 'var(--cooldown-text)' }}
      >
        {timeLeft}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border tabular-nums"
      style={
        status === 'ready'
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
      {status === 'ready' ? (
        <Check className="w-3 h-3 stroke-[2.5]" />
      ) : (
        <Clock className="w-3 h-3" />
      )}
      <span>{timeLeft}</span>
    </span>
  )
}
