import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
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
  const [form, setForm] = useState({ 
    service_name: '', 
    next_billing_date: '', 
    billing_interval: 'monthly',
    custom_interval_days: '',
    amount: '', 
    currency: 'PHP', 
    notes: '' 
  })
  const [iconFile, setIconFile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      if (subscription) {
        // Extract YYYY-MM-DD from ISO string for standard HTML5 date input
        const dateStr = subscription.next_billing_date ? subscription.next_billing_date.split('T')[0] : ''
        
        setForm({
          service_name: subscription.service_name,
          next_billing_date: dateStr,
          billing_interval: subscription.billing_interval || 'monthly',
          custom_interval_days: subscription.custom_interval_days || '',
          amount: subscription.amount,
          currency: subscription.currency,
          notes: subscription.notes || ''
        })
      } else {
        // Default to today for new subscriptions
        const today = new Date().toISOString().split('T')[0]
        setForm({ 
          service_name: '', 
          next_billing_date: today,
          billing_interval: 'monthly',
          custom_interval_days: '',
          amount: '', 
          currency: 'PHP', 
          notes: '' 
        })
      }
      setIconFile(null)
      setError('')
    }
  }, [isOpen, subscription])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    
    if (!form.next_billing_date) { setError('Please select a billing date.'); return }
    if (form.billing_interval === 'custom' && (!form.custom_interval_days || form.custom_interval_days < 1)) {
      setError('Please provide a valid custom interval in days.'); return
    }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { setError('Amount must be a positive number.'); return }
    
    setLoading(true)
    
    let subId = subscription?.id

    const payload = {
      service_name: form.service_name, 
      next_billing_date: form.next_billing_date,
      billing_interval: form.billing_interval,
      custom_interval_days: form.billing_interval === 'custom' ? parseInt(form.custom_interval_days) : null,
      amount: parseFloat(form.amount), 
      currency: form.currency, 
      notes: form.notes || null
    }

    if (subscription) {
      const { error: err } = await supabase.from('subscriptions').update(payload).eq('id', subscription.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      payload.user_id = user.id
      const { data, error: err } = await supabase.from('subscriptions').insert(payload).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      if (data) subId = data.id
    }

    if (iconFile && subId) {
      try {
        const base64 = await resizeImageToBase64(iconFile, 128)
        const { error: urlErr } = await supabase.from('subscriptions').update({ icon_url: base64 }).eq('id', subId)
        if (urlErr) {
          setError(`Could not save icon: ${urlErr.message}`)
          setLoading(false)
          return
        }
      } catch (err) {
        setError('Could not process image. Please try a different file.')
        setLoading(false)
        return
      }
    }

    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Next Billing Date</label>
              <input type="date" required className={inputCls}
                value={form.next_billing_date} onChange={e => setForm({ ...form, next_billing_date: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Billing Interval</label>
              <select className={inputCls} value={form.billing_interval} onChange={e => setForm({ ...form, billing_interval: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {form.billing_interval === 'custom' && (
            <div>
              <label className={labelCls}>Custom Interval (Days)</label>
              <input type="number" required min="1" className={inputCls} placeholder="e.g. 14 for bi-weekly"
                value={form.custom_interval_days} onChange={e => setForm({ ...form, custom_interval_days: e.target.value })} />
            </div>
          )}

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
