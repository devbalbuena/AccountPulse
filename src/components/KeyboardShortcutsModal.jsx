import { useRef } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useFocusTrap } from '@/lib/useFocusTrap'

const SHORTCUT_GROUPS = [
  {
    title: 'Global Actions',
    items: [
      { keys: ['Ctrl', 'K'], description: 'Open Quick Command Palette (Search & Drain)' },
      { keys: ['?'], description: 'Open Keyboard Shortcuts Cheat-Sheet' },
      { keys: ['B'], description: 'Toggle Privacy / Screen-Share Mode (Blur Emails)' },
      { keys: ['T'], description: 'Toggle Light / Dark Theme' },
      { keys: ['Esc'], description: 'Close active modal, drawer, or command palette' },
    ],
  },
  {
    title: 'Quick Navigation',
    items: [
      { keys: ['Alt', '1'], description: 'Go to Dashboard (Command Center)' },
      { keys: ['Alt', '2'], description: 'Go to Accounts Page' },
      { keys: ['Alt', '3'], description: 'Go to Subscriptions Page' },
      { keys: ['Alt', '4'], description: 'Go to Reports & Analytics' },
    ],
  },
]

export default function KeyboardShortcutsModal({ open, onClose }) {
  const modalRef = useRef(null)
  useFocusTrap(modalRef, open, onClose)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-sm font-bold text-foreground">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Navigate and control AccountPulse without leaving your keyboard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts modal"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 overflow-hidden">
                {group.items.map(item => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-foreground font-medium">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map(k => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 rounded-md bg-card border border-border text-[11px] font-mono font-bold text-foreground shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Tip: Press ? anytime outside text inputs to toggle this guide</span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-primary hover:underline"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
