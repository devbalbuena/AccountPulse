import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertTriangle, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function SensitiveActionModal({ 
  isOpen, 
  onClose, 
  title = "Confirm Action", 
  description = "This action is sensitive and requires confirmation.",
  confirmText = "Confirm",
  confirmPhrase, 
  requirePassword = false, 
  onConfirm 
}) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (confirmPhrase) {
      if (inputValue !== confirmPhrase) {
        setError(`Please type exactly "${confirmPhrase}" to confirm.`)
        return
      }
    } else if (requirePassword) {
      if (!inputValue) {
        setError('Please enter your password.')
        return
      }
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Could not verify user.')
        setLoading(false)
        return
      }
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: inputValue
      })
      
      if (authErr) {
        setError('Incorrect password.')
        setLoading(false)
        return
      }
    }

    setLoading(true)
    try {
      await onConfirm()
      onClose()
      setInputValue('')
    } catch (err) {
      setError(err.message || 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setInputValue('')
        setError('')
        onClose()
      }
    }}>
      <DialogContent className="w-[95vw] sm:max-w-md p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #ef4444 15%, transparent)', color: '#ef4444' }}>
              {requirePassword ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <DialogTitle className="text-xl" style={{ color: 'var(--foreground)' }}>{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {description}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm font-medium" style={{ background: 'color-mix(in srgb, #ef4444 10%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 20%, transparent)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {confirmPhrase && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Type <span className="font-bold select-all" style={{ color: 'var(--foreground)' }}>"{confirmPhrase}"</span> to confirm
              </label>
              <input 
                type="text" 
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-2 transition-colors"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', '--tw-ring-color': 'color-mix(in srgb, #ef4444 50%, transparent)' }}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={confirmPhrase}
              />
            </div>
          )}

          {requirePassword && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Current Password
              </label>
              <input 
                type="password" 
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-2 transition-colors"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', '--tw-ring-color': 'color-mix(in srgb, #ef4444 50%, transparent)' }}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => { setInputValue(''); setError(''); onClose(); }}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-muted"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || (!inputValue && (confirmPhrase || requirePassword))}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ background: '#ef4444' }}
            >
              {loading ? 'Processing...' : confirmText}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
