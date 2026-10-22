import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ToastContext = createContext(null)

function ToastItem({ toast, onDismiss }) {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    // 8 second duration
    const DURATION = 8000
    const start = Date.now()
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100)
      setProgress(remaining)
      if (elapsed >= DURATION) {
        clearInterval(interval)
        onDismiss()
      }
    }, 16)
    
    return () => clearInterval(interval)
  }, [onDismiss])

  let borderColor = '#f59e0b'
  let label = '⏱ Cooldown Ending Soon'
  let subtext = 'Tap to view or dismiss'

  if (toast.type === 'success') {
    borderColor = '#10b981'
    label = '✓ Success'
    subtext = toast.action ? '' : 'Dismiss'
  } else if (toast.type === 'ready') {
    borderColor = '#10b981'
    label = '✓ Quota Ready'
    subtext = 'Tap to view or dismiss'
  } else if (toast.type === 'info') {
    borderColor = '#06b6d4'
    label = 'ℹ Info'
    subtext = 'Dismiss'
  } else if (toast.type === 'error' || toast.type === 'expired') {
    borderColor = '#ef4444'
    label = '⚠ Error'
    subtext = 'Tap to view or dismiss'
  }
  
  return (
    <div 
      className="relative flex items-start gap-3 w-80 rounded-[10px] p-3 sm:p-4 mb-2 shadow-2xl transition-all duration-300 animate-in slide-in-from-right-8 overflow-hidden cursor-pointer hover:bg-muted/30"
      style={{ 
        background: 'var(--card)', 
        border: '1px solid var(--border)', 
        borderLeft: `4px solid ${borderColor}`
      }}
      onClick={() => {
        navigate('/accounts')
        onDismiss()
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[11px] uppercase tracking-wider mb-1" style={{ color: borderColor }}>
          {label}
        </p>
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
          {toast.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {subtext && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {subtext}
            </p>
          )}
          {toast.action && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toast.action.onClick?.()
                onDismiss()
              }}
              className="text-xs font-bold underline px-1.5 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
              style={{ color: borderColor }}
            >
              {toast.action.label || 'Undo'}
            </button>
          )}
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        className="shrink-0 rounded-full p-1 hover:bg-muted transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full transition-all duration-75"
          style={{ 
            width: `${progress}%`,
            background: borderColor
          }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    setToasts(prev => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2)
      const newToast = { ...toast, id }
      // Stack max 4 toasts
      const updated = [...prev, newToast]
      if (updated.length > 4) return updated.slice(updated.length - 4)
      return updated
    })
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col pointer-events-none">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
