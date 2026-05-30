import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ImageIcon, Plus, Trash2 } from 'lucide-react'

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5"

function resizeImageToBase64(file, maxSize = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

function emptyTimer() {
  return { id: null, model_name: 'Model', interval_days: '', interval_hours: '', touched: false, originalNextDueAt: null }
}

export default function AccountModal({ isOpen, onClose, account, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ email: '', platform: '', type: '', notes: '' })
  const [timers, setTimers] = useState([emptyTimer()])
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState('')
  
  useEffect(() => {
    if (isOpen) {
      if (account) {
        setForm({
          email: account.email,
          platform: account.platform,
          type: account.type,
          notes: account.notes || ''
        })
        setIconPreview(account.icon_url || '')
        
        if (account.token_timers && account.token_timers.length > 0) {
          const loadedTimers = account.token_timers.slice(0, 2).map(t => {
            const totalHours = t.interval_hours || 0
            return {
              id: t.id,
              model_name: t.model_name || 'Model',
              interval_days: Math.floor(totalHours / 24) || '',
              interval_hours: totalHours % 24 || '',
              touched: false,
              originalNextDueAt: t.next_due_at || null
            }
          })
          setTimers(loadedTimers)
        } else {
          setTimers([emptyTimer()])
        }
      } else {
        setForm({ email: '', platform: '', type: '', notes: '' })
        setIconPreview('')
        setTimers([emptyTimer()])
      }
      setIconFile(null)
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

    if (iconFile) {
      try {
        const base64 = await resizeImageToBase64(iconFile, 128)
        const { error: urlErr } = await supabase.from('accounts').update({ icon_url: base64 }).eq('id', accId)
        if (urlErr) {
          setError(`Could not save icon: ${urlErr.message}`)
        }
      } catch (err) {
        setError('Could not process image.')
      }
    }

    // Handle timers
    const savedTimerIds = []
    
    for (const t of timers) {
      const days = parseInt(t.interval_days) || 0
      const hours = parseInt(t.interval_hours) || 0
      const totalHours = (days * 24) + hours
      
      if (totalHours > 0) {
        // State Preservation Logic: only reset time if explicitly touched
        const nextDue = t.touched
          ? new Date(Date.now() + totalHours * 3600000).toISOString()
          : (t.originalNextDueAt || new Date(Date.now() + totalHours * 3600000).toISOString())
          
        const timerData = { 
          account_id: accId, 
          model_name: t.model_name,
          interval_hours: totalHours, 
          next_due_at: nextDue 
        }
        
        if (t.id) {
          await supabase.from('token_timers').update(timerData).eq('id', t.id)
          savedTimerIds.push(t.id)
        } else {
          const { data } = await supabase.from('token_timers').insert(timerData).select().single()
          if (data) savedTimerIds.push(data.id)
        }
      } else if (t.id) {
        // If they cleared the time inputs, delete the timer
        await supabase.from('token_timers').delete().eq('id', t.id)
      }
    }
    
    // Clean up any timers that were removed from the UI entirely
    if (account?.token_timers) {
      for (const oldT of account.token_timers) {
        if (!savedTimerIds.includes(oldT.id)) {
          await supabase.from('token_timers').delete().eq('id', oldT.id)
        }
      }
    }

    setLoading(false)
    onSave(form.platform)
    onClose()
  }
  
  function updateTimer(index, field, value) {
    const newTimers = [...timers]
    newTimers[index][field] = value
    if (field === 'interval_days' || field === 'interval_hours') {
      newTimers[index].touched = true
    }
    setTimers(newTimers)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
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
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <input type="text" required className={inputCls} placeholder="e.g. Facebook, Gmail, Netflix"
                  value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <label className="cursor-pointer group flex flex-col items-center justify-center w-[42px] h-[42px] rounded-xl border border-input bg-background overflow-hidden relative shrink-0 hover:border-ap-accent transition-colors">
                  {iconPreview ? (
                    <img src={iconPreview} alt="Platform icon" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) {
                      setIconFile(file)
                      setIconPreview(URL.createObjectURL(file))
                    }
                  }} />
                </label>
                <span className="text-[9px] text-muted-foreground uppercase font-semibold">Icon</span>
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <input type="text" required className={inputCls} placeholder="e.g. Social, AI, Streaming"
              value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Notes <span className="text-slate-400">(optional)</span></label>
            <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Any notes…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="border-t border-border/50 pt-5 mt-1 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Token Refresh Timers <span className="font-normal normal-case">(optional, max 2)</span>
              </p>
              {timers.length < 2 && (
                <button type="button" onClick={() => setTimers([...timers, emptyTimer()])}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors">
                  <Plus className="w-3 h-3" /> Add Model
                </button>
              )}
            </div>
            
            {timers.map((t, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border bg-muted/20 relative" style={{ borderColor: 'var(--border)' }}>
                {timers.length > 1 && (
                  <button type="button" onClick={() => setTimers(timers.filter((_, i) => i !== idx))}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                
                <div className="mb-3 pr-8">
                  <label className={labelCls}>Model Name</label>
                  <input type="text" className={inputCls} placeholder="e.g. Claude 3.5 Sonnet"
                    value={t.model_name} onChange={e => updateTimer(idx, 'model_name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Interval (Days)</label>
                    <input type="number" min="0" className={inputCls} placeholder="0"
                      value={t.interval_days} onChange={e => updateTimer(idx, 'interval_days', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Interval (Hours)</label>
                    <input type="number" min="0" max="23" className={inputCls} placeholder="0"
                      value={t.interval_hours} onChange={e => updateTimer(idx, 'interval_hours', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
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
