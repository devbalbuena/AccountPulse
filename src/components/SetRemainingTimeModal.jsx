import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Clock, AlertCircle } from 'lucide-react'
import { addDuration, formatRefreshPreview } from '@/lib/durationUtils'

const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm bg-background border border-input text-foreground text-center placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 text-center"

export default function SetRemainingTimeModal({ isOpen, onClose, timer, onSave }) {
  const [days, setDays] = useState(0)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [error, setError] = useState('')
  const [previewDate, setPreviewDate] = useState(null)
  const [loading, setLoading] = useState(false)

  // Initialize or prefill based on current remaining time if positive
  useEffect(() => {
    if (!isOpen) return
    setError('')
    setLoading(false)

    if (timer?.next_due_at) {
      const diff = new Date(timer.next_due_at) - new Date()
      if (diff > 0) {
        const totalMinutes = Math.floor(diff / 60000)
        const d = Math.floor(totalMinutes / 1440)
        const h = Math.floor((totalMinutes % 1440) / 60)
        const m = totalMinutes % 60
        setDays(d)
        setHours(h)
        setMinutes(m)
        setPreviewDate(addDuration(d, h, m))
        return
      }
    }

    setDays(0)
    setHours(0)
    setMinutes(0)
    setPreviewDate(null)
  }, [isOpen, timer])

  // Update live preview when inputs change
  useEffect(() => {
    const d = parseInt(days, 10) || 0
    const h = parseInt(hours, 10) || 0
    const m = parseInt(minutes, 10) || 0

    if (d > 0 || h > 0 || m > 0) {
      setError('')
      setPreviewDate(addDuration(d, h, m))
    } else {
      setPreviewDate(null)
    }
  }, [days, hours, minutes])

  async function handleSubmit(e) {
    e.preventDefault()
    const d = Math.max(0, parseInt(days, 10) || 0)
    const h = Math.max(0, parseInt(hours, 10) || 0)
    const m = Math.max(0, parseInt(minutes, 10) || 0)

    if (d === 0 && h === 0 && m === 0) {
      setError('Please enter at least 1 minute of remaining time.')
      return
    }

    setLoading(true)
    try {
      await onSave({ days: d, hours: h, minutes: m })
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to update remaining time.')
    } finally {
      setLoading(false)
    }
  }

  const modelLabel = timer?.model_name || 'Timer'
  const modelColor = timer?.color || 'var(--ap-accent)'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-md p-5 sm:p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: modelColor }} />
            <DialogTitle className="text-lg font-bold">Set Remaining Time</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Set when <strong style={{ color: modelColor }}>{modelLabel}</strong> quota will be ready.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Inputs Row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Days</label>
              <input
                type="number"
                min="0"
                max="365"
                value={days}
                onChange={e => setDays(Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))}
                className={inputCls}
                placeholder="0"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block text-center">0 - 365</span>
            </div>

            <div>
              <label className={labelCls}>Hours</label>
              <input
                type="number"
                min="0"
                max="23"
                value={hours}
                onChange={e => setHours(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                className={inputCls}
                placeholder="0"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block text-center">0 - 23</span>
            </div>

            <div>
              <label className={labelCls}>Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                className={inputCls}
                placeholder="0"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block text-center">0 - 59</span>
            </div>
          </div>

          {/* Live Preview Box */}
          <div 
            className="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs"
            style={{ 
              background: 'color-mix(in srgb, var(--ap-accent) 5%, var(--card))',
              borderColor: 'color-mix(in srgb, var(--ap-accent) 25%, var(--border))'
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Ready Schedule</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {previewDate ? `Ready on ${formatRefreshPreview(previewDate)}` : 'Enter duration to calculate ready time'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-muted transition-colors text-muted-foreground"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Set Timer'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
