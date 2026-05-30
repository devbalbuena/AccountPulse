import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { computeNextBillingDate } from '@/lib/subscriptionUtils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'JPY']

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5"

// Resize image to maxSize x maxSize and return as base64 JPEG data URL
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

export default function SubscriptionModal({ isOpen, onClose, subscription, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ service_name: '', billing_day: '', amount: '', currency: 'PHP', notes: '' })
  const [iconFile, setIconFile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      if (subscription) {
        setForm({
          service_name: subscription.service_name,
          billing_day: subscription.billing_day,
          amount: subscription.amount,
          currency: subscription.currency,
          notes: subscription.notes || ''
        })
      } else {
        setForm({ service_name: '', billing_day: '', amount: '', currency: 'PHP', notes: '' })
      }
      setIconFile(null)
      setError('')
    }
  }, [isOpen, subscription])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    
    const day = parseInt(form.billing_day)
    if (isNaN(day) || day < 1 || day > 31) { setError('Billing day must be between 1 and 31.'); return }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { setError('Amount must be a positive number.'); return }
    
    setLoading(true)
    
    let subId = subscription?.id

    if (subscription) {
      const { error: err } = await supabase.from('subscriptions').update({
        service_name: form.service_name, 
        billing_day: day,
        next_billing_date: computeNextBillingDate(day),
        amount: parseFloat(form.amount), 
        currency: form.currency, 
        notes: form.notes || null
      }).eq('id', subscription.id)
      
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { data, error: err } = await supabase.from('subscriptions').insert({
        user_id: user.id, 
        service_name: form.service_name, 
        billing_day: day,
        next_billing_date: computeNextBillingDate(day),
        amount: parseFloat(form.amount), 
        currency: form.currency, 
        notes: form.notes || null
      }).select().single()
      
      if (err) { setError(err.message); setLoading(false); return }
      if (data) subId = data.id
    }

    if (iconFile && subId) {
      try {
        const base64 = await resizeImageToBase64(iconFile, 128)
        const { error: urlErr } = await supabase.from('subscriptions').update({ icon_url: base64 }).eq('id', subId)
        if (urlErr) {
          console.error('[Icon] Failed to save base64 to DB:', urlErr)
          setError(`Could not save icon: ${urlErr.message}`)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('[Icon] Resize error:', err)
        setError('Could not process image. Please try a different file.')
        setLoading(false)
        return
      }
    }

    setLoading(false)
    onSave()
    onClose()
  }

  const previewDay = parseInt(form.billing_day)
  const previewDate = (!isNaN(previewDay) && previewDay >= 1 && previewDay <= 31) ? computeNextBillingDate(previewDay) : null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{subscription ? 'Edit Subscription' : 'Add Subscription'}</DialogTitle>
          <DialogDescription>
            {subscription ? 'Update the details for this subscription.' : 'Fill out the details for your new subscription.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Service Name</label>
            <input type="text" required className={inputCls} placeholder="e.g. Netflix, Spotify, GitHub"
              value={form.service_name} onChange={e => setForm({ ...form, service_name: e.target.value })} />
          </div>

          <div>
            <label className={labelCls}>Platform Icon <span className="text-slate-400">(optional)</span></label>
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/webp" 
              onChange={e => setIconFile(e.target.files[0])}
              className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors"
            />
            {iconFile && <p className="text-xs mt-1 text-emerald-500">Selected: {iconFile.name}</p>}
          </div>

          <div>
            <label className={labelCls}>Billing Day of Month</label>
            <input type="number" required min="1" max="31" className={inputCls} placeholder="e.g. 15"
              value={form.billing_day} onChange={e => setForm({ ...form, billing_day: e.target.value })} />
            {previewDate && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                Next bill: {new Date(previewDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount</label>
              <input type="number" required min="0.01" step="0.01" className={inputCls} placeholder="0.00"
                value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select className={inputCls} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes <span className="text-slate-400">(optional)</span></label>
            <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Any notes…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex items-center gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-muted text-muted-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
