import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Sun, Moon, User, Palette, Bell, ShieldCheck, Check, Laptop, LogOut, Clock, Plus, Trash2, Download, Upload, Database } from 'lucide-react'
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator'
import SensitiveActionModal from '@/components/SensitiveActionModal'
import {
  exportFullBackupJSON,
  exportAccountsCSV,
  exportSubscriptionsCSV,
  restoreFromBackupJSON,
} from '@/lib/dataBackup'
import {
  getCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
  TIMER_PRESETS,
} from '@/lib/timerPresets'
import {
  isBrowserPushSupported,
  getBrowserPushPermission,
  isBrowserPushEnabled,
  setBrowserPushEnabled,
  requestBrowserPushPermission,
  sendBrowserNotification,
} from '@/lib/browserNotifications'
import {
  getWebhookConfig,
  saveWebhookConfig,
  sendTestWebhook,
} from '@/lib/webhookDispatcher'

const TABS = [
  { id: 'profile',      label: 'Profile',       icon: User },
  { id: 'appearance',   label: 'Appearance',    icon: Palette },
  { id: 'notifications',label: 'Notifications', icon: Bell },
  { id: 'presets',      label: 'Timer Presets', icon: Clock },
  { id: 'backup',       label: 'Data & Backup', icon: Database },
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
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-primary text-primary-foreground text-xl font-bold shadow-xs">
          {initial}
        </div>
        <div>
          <p className="text-base font-bold text-foreground">{username}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Read-only fields */}
      <div className="space-y-4 p-5 rounded-xl border border-border bg-card shadow-xs">
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
        <p className="text-xs text-muted-foreground">
          Your email address is managed by your authentication provider and cannot be changed here.
        </p>
      </div>
    </div>
  )
}

// ─── Appearance Tab ─────────────────────────────────────────────────────────────
function AppearanceTab() {
  const { mode, setMode, resolvedTheme } = useTheme()

  const options = [
    {
      id: 'system',
      label: 'System',
      desc: 'Matches your OS setting',
      icon: Laptop,
      active: mode === 'system',
    },
    {
      id: 'light',
      label: 'Light',
      desc: 'Soft, calm light theme',
      icon: Sun,
      active: mode === 'light',
    },
    {
      id: 'dark',
      label: 'Dark',
      desc: 'Soft charcoal dark theme',
      icon: Moon,
      active: mode === 'dark',
    },
  ]

  return (
    <div className="space-y-4 max-w-lg">
      <div
        className="p-5 rounded-2xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Theme Preference</p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Active theme: <strong className="font-semibold capitalize text-foreground">{resolvedTheme}</strong>
          {mode === 'system' && ' (Automatic from system)'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {options.map(opt => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[92px] relative ${
                  opt.active
                    ? 'border-primary ring-1 ring-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Icon className="w-4 h-4 text-primary" />
                  {opt.active && <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />}
                </div>
                <div className="mt-2">
                  <p className="text-xs font-bold text-foreground">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Notifications Tab ──────────────────────────────────────────────────────────
function NotificationsTab() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState({
    account_expiry: true,
    subscription_renewal: true,
    account_added: false,
    weekly_summary: false,
  })
  const [pushSupported] = useState(() => isBrowserPushSupported())
  const [pushPermission, setPushPermission] = useState(() => getBrowserPushPermission())
  const [pushEnabled, setPushEnabled] = useState(() => isBrowserPushEnabled())
  const [pushTestMsg, setPushTestMsg] = useState('')
  const [webhooks, setWebhooks] = useState(() => getWebhookConfig())
  const [webhookStatus, setWebhookStatus] = useState('')

  function handleWebhookChange(field, val) {
    const next = { ...webhooks, [field]: val }
    setWebhooks(next)
    saveWebhookConfig(next)
  }

  async function handleTestWebhook(provider) {
    setWebhookStatus(`Sending test ping to ${provider}...`)
    const ok = await sendTestWebhook(provider, webhooks)
    setWebhookStatus(
      ok
        ? `Test alert delivered to ${provider}!`
        : `Failed to send ${provider} alert. Check your webhook URL or token.`
    )
    setTimeout(() => setWebhookStatus(''), 4000)
  }

  async function handleToggleBrowserPush() {
    if (!pushSupported) return
    if (pushPermission !== 'granted') {
      const perm = await requestBrowserPushPermission()
      setPushPermission(perm)
      setPushEnabled(perm === 'granted')
      if (perm === 'granted') {
        sendBrowserNotification('AccountPulse Notifications Enabled', {
          body: 'You will now receive native desktop/mobile alerts when cooldown timers hit zero.',
        })
      }
      return
    }
    const next = !pushEnabled
    setBrowserPushEnabled(next)
    setPushEnabled(next)
  }

  async function handleSendTestBrowserPush() {
    if (pushPermission !== 'granted') {
      const perm = await requestBrowserPushPermission()
      setPushPermission(perm)
      if (perm !== 'granted') {
        setPushTestMsg('Browser notification permission was denied or dismissed.')
        return
      }
      setPushEnabled(true)
    }
    setBrowserPushEnabled(true)
    setPushEnabled(true)
    const sent = sendBrowserNotification('AccountPulse — Test Alert', {
      body: 'Desktop & mobile push notifications are working!',
      tag: 'ap-test-notif',
    })
    setPushTestMsg(sent ? 'Test push notification sent to your OS!' : 'Could not trigger browser notification.')
    setTimeout(() => setPushTestMsg(''), 3500)
  }

  useEffect(() => {
    if (!user) return
    async function fetchSettings() {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data && !error) {
        setPrefs({
          account_expiry: data.account_expiry ?? true,
          subscription_renewal: data.subscription_renewal ?? true,
          account_added: data.account_added ?? false,
          weekly_summary: data.weekly_summary ?? false,
        })
      }
    }
    fetchSettings()
  }, [user])

  async function handleToggle(key) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    if (!user) return

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...updated,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (error) {
      console.warn('Could not persist setting to user_settings (pending migration):', error.message)
    }
  }

  const rows = [
    { key: 'account_expiry',      label: 'Token Ready Alerts',        desc: 'Get notified when a token timer cooldown finishes and quota is ready to use.' },
    { key: 'subscription_renewal',label: 'Subscription Renewals',     desc: 'Reminders 7 days before a subscription renews.' },
    { key: 'account_added',       label: 'Account Activity',          desc: 'Notify when accounts are added, edited, or archived.' },
    { key: 'weekly_summary',      label: 'Weekly Summary',            desc: 'A weekly digest of your account and spending activity.' },
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Browser Native Push Notifications Card */}
      <div
        className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-3"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground">Browser Native Push Notifications</p>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  !pushSupported
                    ? 'bg-muted text-muted-foreground border-border'
                    : pushPermission === 'granted' && pushEnabled
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : pushPermission === 'denied'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200'
                }`}
              >
                {!pushSupported
                  ? 'Unsupported'
                  : pushPermission === 'granted' && pushEnabled
                    ? 'Active'
                    : pushPermission === 'denied'
                      ? 'Blocked in Browser'
                      : 'Permission Needed'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Trigger native OS desktop and mobile push notifications when a cooldown timer hits zero—even when you are on another browser tab.
            </p>
          </div>

          <button
            type="button"
            disabled={!pushSupported}
            onClick={handleToggleBrowserPush}
            className="shrink-0 w-10 h-6 rounded-full transition-colors relative disabled:opacity-40"
            style={{ background: pushEnabled && pushPermission === 'granted' ? 'var(--primary)' : 'var(--border)' }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: pushEnabled && pushPermission === 'granted' ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            {pushTestMsg || 'Uses Web Notifications API with background tab support'}
          </span>
          <button
            type="button"
            onClick={handleSendTestBrowserPush}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            Send Test Push
          </button>
        </div>
      </div>

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
            onClick={() => handleToggle(row.key)}
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
        Note: Notification preferences are persisted to your account and synced with the email alert service.
      </p>

      {/* Webhook Alerts (Discord / Telegram / Slack) */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-4 mt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-foreground">Webhook Alerts (Discord / Telegram / Slack)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send instant alert pings to your personal Discord channel, Telegram bot, or Slack workspace when groups finish cooling down.
            </p>
          </div>
          {webhookStatus && (
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
              {webhookStatus}
            </span>
          )}
        </div>

        {/* Discord Webhook */}
        <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Discord Webhook</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestWebhook('discord')}
                disabled={!webhooks.discordUrl}
                className="px-2.5 py-1 rounded-md border border-border bg-card text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-40"
              >
                Test Discord
              </button>
              <button
                type="button"
                onClick={() => handleWebhookChange('discordEnabled', !webhooks.discordEnabled)}
                className="w-9 h-5 rounded-full transition-colors relative"
                style={{ background: webhooks.discordEnabled ? 'var(--primary)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: webhooks.discordEnabled ? 'translateX(17px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          </div>
          <input
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhooks.discordUrl}
            onChange={e => handleWebhookChange('discordUrl', e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Telegram Bot */}
        <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Telegram Bot Alert</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestWebhook('telegram')}
                disabled={!webhooks.telegramBotToken || !webhooks.telegramChatId}
                className="px-2.5 py-1 rounded-md border border-border bg-card text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-40"
              >
                Test Telegram
              </button>
              <button
                type="button"
                onClick={() => handleWebhookChange('telegramEnabled', !webhooks.telegramEnabled)}
                className="w-9 h-5 rounded-full transition-colors relative"
                style={{ background: webhooks.telegramEnabled ? 'var(--primary)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: webhooks.telegramEnabled ? 'translateX(17px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Bot Token (123456:ABC-DEF...)"
              value={webhooks.telegramBotToken}
              onChange={e => handleWebhookChange('telegramBotToken', e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Chat ID (e.g. 987654321)"
              value={webhooks.telegramChatId}
              onChange={e => handleWebhookChange('telegramChatId', e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Slack Webhook */}
        <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Slack Incoming Webhook</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestWebhook('slack')}
                disabled={!webhooks.slackUrl}
                className="px-2.5 py-1 rounded-md border border-border bg-card text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-40"
              >
                Test Slack
              </button>
              <button
                type="button"
                onClick={() => handleWebhookChange('slackEnabled', !webhooks.slackEnabled)}
                className="w-9 h-5 rounded-full transition-colors relative"
                style={{ background: webhooks.slackEnabled ? 'var(--primary)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: webhooks.slackEnabled ? 'translateX(17px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          </div>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={webhooks.slackUrl}
            onChange={e => handleWebhookChange('slackUrl', e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Custom Timer Presets Tab ───────────────────────────────────────────────────
function PresetsTab() {
  const [customPresets, setCustomPresets] = useState(() => getCustomPresets())
  const [form, setForm] = useState({
    model_name: '',
    group_name: '',
    interval_days: '0',
    interval_hours: '3',
    color: '#2563eb',
    notify_on_ready: true,
  })
  const [msg, setMsg] = useState('')

  const starterExamples = [
    { model_name: 'DeepSeek R1 3h', group_name: 'DeepSeek', interval_days: 0, interval_hours: 3, color: '#3b82f6' },
    { model_name: 'Claude Team 24h', group_name: 'Claude / GPT', interval_days: 1, interval_hours: 0, color: '#8b5cf6' },
    { model_name: 'OpenAI o3-mini 12h', group_name: 'ChatGPT', interval_days: 0, interval_hours: 12, color: '#10b981' },
  ]

  function handleAddPreset(e) {
    e.preventDefault()
    if (!form.model_name.trim()) return
    const total = (parseInt(form.interval_days) || 0) * 24 + (parseInt(form.interval_hours) || 0)
    if (total <= 0) {
      setMsg('Interval must be at least 1 hour.')
      return
    }
    saveCustomPreset(form)
    setCustomPresets(getCustomPresets())
    setForm({
      model_name: '',
      group_name: '',
      interval_days: '0',
      interval_hours: '3',
      color: '#2563eb',
      notify_on_ready: true,
    })
    setMsg('Custom preset saved! Available in Account Modal.')
    setTimeout(() => setMsg(''), 3000)
  }

  function handleQuickAddStarter(ex) {
    saveCustomPreset({ ...ex, notify_on_ready: true })
    setCustomPresets(getCustomPresets())
    setMsg(`Added "${ex.model_name}" to your custom presets!`)
    setTimeout(() => setMsg(''), 2500)
  }

  function handleRemovePreset(id) {
    setCustomPresets(deleteCustomPreset(id))
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Create Custom Preset Card */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground">Create Custom Timer Preset</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Save your own model cooldown templates (e.g. DeepSeek 3h, Claude Team 24h) for 1-click selection when adding or editing accounts.
            </p>
          </div>
          {msg && (
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
              {msg}
            </span>
          )}
        </div>

        {/* Quick Starter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Quick Add:</span>
          {starterExamples.map(ex => (
            <button
              key={ex.model_name}
              type="button"
              onClick={() => handleQuickAddStarter(ex)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <Plus className="w-3 h-3 text-primary" />
              <span>{ex.model_name}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleAddPreset} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60">
          <div className="sm:col-span-2">
            <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Model Name</label>
            <input
              type="text"
              required
              placeholder="e.g. DeepSeek R1 3-Hour"
              value={form.model_name}
              onChange={e => setForm({ ...form, model_name: e.target.value })}
              className={inputCls}
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Group Name</label>
            <input
              type="text"
              placeholder="e.g. DeepSeek, Claude / GPT"
              value={form.group_name}
              onChange={e => setForm({ ...form, group_name: e.target.value })}
              className={inputCls}
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Days</label>
            <input
              type="number"
              min="0"
              value={form.interval_days}
              onChange={e => setForm({ ...form, interval_days: e.target.value })}
              className={inputCls}
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Hours</label>
            <input
              type="number"
              min="0"
              max="23"
              value={form.interval_hours}
              onChange={e => setForm({ ...form, interval_hours: e.target.value })}
              className={inputCls}
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--muted-foreground)' }}>Color</label>
            <input
              type="color"
              value={form.color}
              onChange={e => setForm({ ...form, color: e.target.value })}
              className="w-full h-[38px] p-1 rounded-lg border border-border bg-background cursor-pointer"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors shadow-xs"
            >
              Save Preset
            </button>
          </div>
        </form>
      </div>

      {/* Saved Custom Presets List */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-foreground">
          Your Saved Custom Presets ({customPresets.length})
        </h3>
        {customPresets.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No custom presets saved yet. Add one above or click &ldquo;Save as Custom Preset&rdquo; inside the Account modal.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {customPresets.map(p => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{p.model_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Group: {p.group_name} &bull; {p.total_hours}h cooldown ({p.interval_days}d {p.interval_hours}h)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePreset(p.id)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                  title="Delete custom preset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Built-in Presets Reference */}
      <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
        <p className="text-xs font-bold text-foreground">Built-in System Presets ({TIMER_PRESETS.filter(p => !p.isCustom).length})</p>
        <div className="flex flex-wrap gap-2">
          {TIMER_PRESETS.filter(p => !p.isCustom).map(p => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-[11px] font-medium text-muted-foreground"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span>{p.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Data Export & Backup Tab ──────────────────────────────────────────────────
function DataBackupTab({ user }) {
  const [statusMsg, setStatusMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleExportJSON() {
    if (!user) return
    setBusy(true)
    setStatusMsg('Preparing full JSON backup...')
    try {
      await exportFullBackupJSON(user.id)
      setStatusMsg('Full JSON backup downloaded!')
    } catch (err) {
      setStatusMsg(`Export failed: ${err.message}`)
    } finally {
      setBusy(false)
      setTimeout(() => setStatusMsg(''), 4000)
    }
  }

  async function handleExportAccountsCSV() {
    if (!user) return
    setBusy(true)
    const { data } = await supabase
      .from('accounts')
      .select('*, token_timers(*)')
      .is('deleted_at', null)
      .eq('user_id', user.id)
    exportAccountsCSV(data || [])
    setBusy(false)
    setStatusMsg('Accounts CSV exported!')
    setTimeout(() => setStatusMsg(''), 3500)
  }

  async function handleExportSubscriptionsCSV() {
    if (!user) return
    setBusy(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .is('deleted_at', null)
      .eq('user_id', user.id)
    exportSubscriptionsCSV(data || [])
    setBusy(false)
    setStatusMsg('Subscriptions CSV exported!')
    setTimeout(() => setStatusMsg(''), 3500)
  }

  async function handleRestoreFile(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setBusy(true)
    setStatusMsg('Restoring backup...')
    try {
      const text = await file.text()
      const { restoredAccounts, restoredSubs } = await restoreFromBackupJSON(user.id, text)
      setStatusMsg(
        `Backup restored! Imported ${restoredAccounts} new account(s) and ${restoredSubs} subscription(s).`
      )
    } catch (err) {
      setStatusMsg(`Restore error: ${err.message}`)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {statusMsg && (
        <div className="px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
          {statusMsg}
        </div>
      )}

      {/* Export Section */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Export Data (CSV &amp; JSON)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Download your accounts, active timers, subscriptions, custom presets, and tags as CSV spreadsheets or a complete JSON snapshot.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleExportJSON}
            className="flex flex-col items-start justify-between p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 transition-colors text-left"
          >
            <Download className="w-4 h-4 text-primary mb-2" />
            <div>
              <p className="text-xs font-bold text-foreground">Full JSON Backup</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">All accounts, timers, subs &amp; presets</p>
            </div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleExportAccountsCSV}
            className="flex flex-col items-start justify-between p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 transition-colors text-left"
          >
            <Download className="w-4 h-4 text-emerald-600 mb-2" />
            <div>
              <p className="text-xs font-bold text-foreground">Accounts CSV</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Spreadsheet of accounts &amp; timers</p>
            </div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleExportSubscriptionsCSV}
            className="flex flex-col items-start justify-between p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 transition-colors text-left"
          >
            <Download className="w-4 h-4 text-purple-600 mb-2" />
            <div>
              <p className="text-xs font-bold text-foreground">Subscriptions CSV</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Spreadsheet of recurring bills</p>
            </div>
          </button>
        </div>
      </div>

      {/* Import / Restore Section */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Import &amp; Restore JSON Backup</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Restore accounts, timers, subscriptions, tags, and custom presets from a previously exported AccountPulse JSON backup file without overwriting existing active items.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors">
          <Upload className="w-4 h-4 text-primary" />
          <span>Choose Backup JSON File to Restore...</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleRestoreFile}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}

// ─── Security Tab ───────────────────────────────────────────────────────────────
function SecurityTab() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ password: '', confirm: '' })
  const [message, setMessage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const lastLogin = localStorage.getItem('accountpulse_last_login')
  const lastBrowser = localStorage.getItem('accountpulse_last_browser') || 'Unknown Device'

  function handleFormSubmit(e) {
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
    setIsModalOpen(true)
  }

  async function executeChangePassword() {
    const { error } = await supabase.auth.updateUser({ password: form.password })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully!' })
      setForm({ password: '', confirm: '' })
    }
  }

  async function handleSignOutAll() {
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    navigate('/login')
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

        <form onSubmit={handleFormSubmit} className="space-y-4">
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
            <PasswordStrengthIndicator password={form.password} />
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
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)' }}
            >
              Update Password
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 p-5 rounded-xl border border-border bg-card shadow-xs">
        <h3 className="text-sm font-semibold mb-4 text-foreground">Current Session</h3>
        <div className="flex items-center gap-3.5 p-3.5 rounded-lg mb-4 bg-muted/40 border border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Laptop className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{lastBrowser}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {lastLogin ? `Started ${new Date(lastLogin).toLocaleString()}` : 'Active now'}
            </p>
          </div>
          <div className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Active
          </div>
        </div>
        <button
          onClick={handleSignOutAll}
          className="flex items-center justify-center w-full gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-destructive/30 hover:bg-destructive/10 text-destructive bg-card shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          Sign Out All Sessions
        </button>
      </div>

      <SensitiveActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Verify Current Password"
        description="Please enter your current password to authorize this change."
        confirmText="Update Password"
        requirePassword={true}
        onConfirm={executeChangePassword}
      />
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
    presets:       <PresetsTab />,
    backup:        <DataBackupTab user={user} />,
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
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px border-b-2 ${
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
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
