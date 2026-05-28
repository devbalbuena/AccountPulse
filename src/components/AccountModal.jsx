import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5"

export default function AccountModal({ isOpen, onClose, account, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ email: '', platform: '', type: '', notes: '', interval_days: '', interval_hours: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      if (account) {
        const totalHours = account.token_timers?.[0]?.interval_hours || 0
        setForm({
          email: account.email,
          platform: account.platform,
          type: account.type,
          notes: account.notes || '',
          interval_days: Math.floor(totalHours / 24) || '',
          interval_hours: totalHours % 24 || ''
        })
      } else {
        setForm({ email: '', platform: '', type: '', notes: '', interval_days: '', interval_hours: '' })
      }
      setError('')
    }
  }, [isOpen, account])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let accId = account?.id

    if (account) {
      const { error: accErr } = await supabase.from('accounts')
        .update({ email: form.email, platform: form.platform, type: form.type, notes: form.notes || null }).eq('id', accId)
      if (accErr) { setError(accErr.message); setLoading(false); return }
    } else {
      const { data: newAcc, error: accErr } = await supabase.from('accounts')
        .insert({ user_id: user.id, email: form.email, platform: form.platform, type: form.type, notes: form.notes || null })
        .select().single()
      if (accErr) { setError(accErr.message); setLoading(false); return }
      accId = newAcc.id
    }

    const days = parseInt(form.interval_days) || 0
    const hours = parseInt(form.interval_hours) || 0
    const totalHours = (days * 24) + hours
    const timerId = account?.token_timers?.[0]?.id

    if (totalHours > 0) {
      const nextDue = new Date(Date.now() + totalHours * 3600000)
      const timerData = { account_id: accId, interval_hours: totalHours, next_due_at: nextDue.toISOString() }
      if (timerId) {
        await supabase.from('token_timers').update(timerData).eq('id', timerId)
      } else {
        await supabase.from('token_timers').insert(timerData)
      }
    } else if (timerId) {
      await supabase.from('token_timers').delete().eq('id', timerId)
    }

    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add Account'}</DialogTitle>
          <DialogDescription>
            {account ? 'Update the details for this account.' : 'Fill out the details for your new account.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <form id="account-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" required className={inputCls} placeholder="account@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Platform</label>
            <input type="text" required className={inputCls} placeholder="e.g. Facebook, Gmail, Netflix"
              value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <input type="text" required className={inputCls} placeholder="e.g. Social, Email, Streaming"
              value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Notes <span className="text-slate-400">(optional)</span></label>
            <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Any notes…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="border-t border-border/50 pt-5 mt-1">
            <p className="text-[11px] font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Token Refresh Interval <span className="font-normal normal-case">(optional)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Days</label>
                <input type="number" min="0" className={inputCls} placeholder="0"
                  value={form.interval_days} onChange={e => setForm({ ...form, interval_days: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Hours</label>
                <input type="number" min="0" max="23" className={inputCls} placeholder="0"
                  value={form.interval_hours} onChange={e => setForm({ ...form, interval_hours: e.target.value })} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-muted text-muted-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
