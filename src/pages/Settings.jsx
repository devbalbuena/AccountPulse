import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { Sun, Moon, User, Palette, Bell, ShieldCheck, Check } from 'lucide-react'

const TABS = [
  { id: 'profile',      label: 'Profile',       icon: User },
  { id: 'appearance',   label: 'Appearance',    icon: Palette },
  { id: 'notifications',label: 'Notifications', icon: Bell },
  { id: 'security',     label: 'Security',      icon: ShieldCheck },
]

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-2 transition-colors"
const labelCls = "block text-xs font-semibold uppercase tracking-wider mb-1.5"

// ─── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ user }) {
  const [isLoaded] = useState(true)
  const username = user?.email?.split('@')[0] || '—'
  const initial  = username[0]?.toUpperCase() || '?'

  return (
    <div className="space-y-6 max-w-lg">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
          style={{ background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)' }}
        >
          {initial}
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--foreground)' }}>{username}</p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{user?.email}</p>
        </div>
      </div>

      {/* Read-only fields */}
      <div className="space-y-4 p-5 rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div>
          <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Username</label>
          <input
            type="text"
            readOnly
            value={username}
            className={`${inputCls} opacity-70 cursor-not-allowed`}
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Email Address</label>
          <input
            type="email"
            readOnly
            value={user?.email || ''}
            className={`${inputCls} opacity-70 cursor-not-allowed`}
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Your email address is managed by your authentication provider and cannot be changed here.
        </p>
      </div>
    </div>
  )
}

// ─── Appearance Tab ─────────────────────────────────────────────────────────────
function AppearanceTab() {
  const { theme, toggle } = useTheme()

  return (
    <div className="space-y-4 max-w-lg">
      <div
        className="p-5 rounded-2xl border flex items-center justify-between gap-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Color Theme</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Currently using <span className="font-medium capitalize">{theme}</span> mode
          </p>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-muted shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          {theme === 'dark'
            ? <><Sun className="w-4 h-4 text-amber-400" /> Light Mode</>
            : <><Moon className="w-4 h-4 text-indigo-400" /> Dark Mode</>
          }
        </button>
      </div>

      {/* Theme Previews */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Light', bg: '#ffffff', fg: '#0f172a', accent: '#6366f1', active: theme === 'light' },
          { label: 'Dark',  bg: '#111827', fg: '#f1f5f9', accent: '#a855f7', active: theme === 'dark'  },
        ].map(t => (
          <button
            key={t.label}
            onClick={toggle}
            className="relative rounded-2xl border-2 p-4 text-left transition-all hover:scale-[1.02]"
            style={{
              background: t.bg,
              borderColor: t.active ? 'var(--ap-accent)' : 'var(--border)',
              boxShadow: t.active ? '0 0 0 3px color-mix(in srgb, var(--ap-accent) 20%, transparent)' : undefined
            }}
          >
            {t.active && (
              <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'var(--ap-accent)' }}>
                <Check className="w-3 h-3 text-white" />
              </span>
            )}
            {/* Mini preview */}
            <div className="space-y-1.5 mb-3">
              <div className="h-2 w-12 rounded-full opacity-60" style={{ background: t.fg }} />
              <div className="h-1.5 w-8 rounded-full opacity-30" style={{ background: t.fg }} />
            </div>
            <div className="flex gap-1.5">
              <div className="h-5 w-5 rounded" style={{ background: t.accent, opacity: 0.8 }} />
              <div className="h-5 flex-1 rounded opacity-20" style={{ background: t.fg }} />
            </div>
            <p className="mt-3 text-xs font-semibold" style={{ color: t.fg, opacity: 0.7 }}>{t.label} Mode</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Notifications Tab ──────────────────────────────────────────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    account_expiry: true,
    subscription_renewal: true,
    account_added: false,
    weekly_summary: false,
  })

  const rows = [
    { key: 'account_expiry',      label: 'Token Expiry Alerts',       desc: 'Get notified when a token timer is about to expire.' },
    { key: 'subscription_renewal',label: 'Subscription Renewals',     desc: 'Reminders 7 days before a subscription renews.' },
    { key: 'account_added',       label: 'Account Activity',          desc: 'Notify when accounts are added, edited, or archived.' },
    { key: 'weekly_summary',      label: 'Weekly Summary',            desc: 'A weekly digest of your account and spending activity.' },
  ]

  return (
    <div className="space-y-3 max-w-lg">
      {rows.map(row => (
        <div
          key={row.key}
          className="p-5 rounded-2xl border flex items-center justify-between gap-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{row.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{row.desc}</p>
          </div>
          {/* Toggle pill */}
          <button
            onClick={() => setPrefs(p => ({ ...p, [row.key]: !p[row.key] }))}
            className="shrink-0 w-10 h-6 rounded-full transition-colors relative"
            style={{ background: prefs[row.key] ? 'var(--ap-accent)' : 'var(--border)' }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: prefs[row.key] ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      ))}
      <p className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>
        Note: Notification preferences are saved locally and will reset on page refresh.
      </p>
    </div>
  )
}

// ─── Security Tab ───────────────────────────────────────────────────────────────
function SecurityTab() {
  const [form, setForm]     = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text }

  async function handleChangePassword(e) {
    e.preventDefault()
    setMessage(null)
    if (form.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (form.password !== form.confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: form.password })
    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully!' })
      setForm({ password: '', confirm: '' })
    }
  }

  return (
    <div className="max-w-lg">
      <div className="p-5 rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)' }}>Change Password</h3>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>New Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 8 characters"
              className={inputCls}
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Confirm New Password</label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              placeholder="Repeat your new password"
              className={inputCls}
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)' }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Settings Page ────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [isLoaded, setIsLoaded] = useState(false)

  // Trigger reveal animation
  useState(() => { setTimeout(() => setIsLoaded(true), 100) })

  const tabContent = {
    profile:       <ProfileTab user={user} />,
    appearance:    <AppearanceTab />,
    notifications: <NotificationsTab />,
    security:      <SecurityTab />,
  }

  return (
    <div className="space-y-0">
      {/* ── Page Header (stays fixed, no animation) ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Manage your account preferences and application configurations.
        </p>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px"
              style={{
                color: isActive ? 'var(--ap-accent)' : 'var(--muted-foreground)',
                borderBottom: isActive ? '2px solid var(--ap-accent)' : '2px solid transparent'
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content (animated) ── */}
      <div className={`transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {tabContent[activeTab]}
      </div>
    </div>
  )
}
