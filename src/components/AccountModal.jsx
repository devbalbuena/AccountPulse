import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ImageIcon, Plus, Trash2, Clock, AlertTriangle, Sparkles, Bell, BookmarkPlus, Tag, X } from 'lucide-react'
import { TIMER_PRESETS, ANTIGRAVITY_4_PRESETS, createTimerFromPreset, getAllTimerPresets, saveCustomPreset } from '@/lib/timerPresets'
import { AI_PLATFORM_CATALOG, resolveUnifiedPlatform, UnifiedPlatformIcon } from '@/lib/platformCategories'
import { SUGGESTED_TAGS, getAccountTags, setAccountTags, syncTagsIntoNotes, stripHashtagsFromNotes, normalizeTag } from '@/lib/accountTags'

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5"

// 8 preset colors for model color picker
const PRESET_COLORS = [
  '#2563eb', // indigo (default)
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#3b82f6', // blue
]

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
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

function emptyTimer() {
  return {
    id: null,
    model_name: 'Model',
    group_name: '',
    color: '#2563eb',
    interval_days: '',
    interval_hours: '',
    // originalIntervalHours tracks what was in the DB on open — used to detect changes
    originalIntervalHours: null,
    // originalNextDueAt is preserved if interval did NOT change
    originalNextDueAt: null,
    showColorPicker: false,
    presetId: '',
    notify_on_ready: false,
  }
}

// Format time remaining from a next_due_at ISO string
function formatRemaining(nextDueAt) {
  if (!nextDueAt) return null
  const diff = new Date(nextDueAt) - new Date()
  if (diff <= 0) return { text: 'Ready', ready: true }
  const totalMin = Math.floor(diff / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || parts.length === 0) parts.push(`${m}m`)
  return { text: parts.join(' ') + ' cooldown remaining', ready: false }
}

// Inline color swatch picker for a single model
function ColorPicker({ color, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-lg border-2 border-white/20 shadow transition-transform hover:scale-110"
        style={{ background: color }}
        title="Pick model color"
      />
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 p-2 rounded-xl border shadow-xl flex gap-1.5 flex-wrap w-[120px]"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false) }}
              className="w-7 h-7 rounded-md transition-transform hover:scale-110"
              style={{
                background: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AccountModal({ isOpen, onClose, account, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ email: '', platform: '', type: '', notes: '' })
  const [timers, setTimers] = useState([emptyTimer()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState('')
  const [availablePresets, setAvailablePresets] = useState(() => getAllTimerPresets())
  const [savedPresetFeedback, setSavedPresetFeedback] = useState(null)
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setAvailablePresets(getAllTimerPresets())
    if (account) {
      setForm({
        email: account.email,
        platform: account.platform,
        type: account.type,
        notes: stripHashtagsFromNotes(account.notes || '')
      })
      setTags(getAccountTags(account))
      setIconPreview(account.icon_url || '')

      if (account.token_timers && account.token_timers.length > 0) {
        const loaded = account.token_timers.map(t => {
          const totalHours = t.interval_hours || 0
          return {
            id: t.id,
            model_name: t.model_name || 'Model',
            group_name: t.group_name || '',
            color: t.color || '#2563eb',
            // Displayed as D/H split for UX
            interval_days: Math.floor(totalHours / 24) || '',
            interval_hours: totalHours % 24 || '',
            // KEY FIX: store original values separately — never pre-mutated
            originalIntervalHours: totalHours,
            originalNextDueAt: t.next_due_at || null,
            showColorPicker: false,
            presetId: '',
            notify_on_ready: t.notify_on_ready ?? (totalHours >= 24),
          }
        })
        setTimers(loaded)
      } else {
        setTimers([emptyTimer()])
      }
    } else {
      setForm({ email: '', platform: '', type: '', notes: '' })
      setIconPreview('')
      setTimers([emptyTimer()])
      setTags([])
    }
    setTagInput('')
    setIconFile(null)
    setError('')
  }, [isOpen, account])

  function handleAddTag(rawTag) {
    const clean = normalizeTag(rawTag)
    if (!clean) return
    setTags(prev => (prev.includes(clean) ? prev : [...prev, clean]))
    setTagInput('')
  }

  function handleRemoveTag(t) {
    setTags(prev => prev.filter(x => x !== t))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let accId = account?.id
    const unified = resolveUnifiedPlatform(form.platform, form.type)
    const cleanEmail = form.email.trim()
    const cleanPlatform = unified.name
    const cleanType = (form.type || '').trim() || unified.category
    const combinedNotes = syncTagsIntoNotes(form.notes, tags)

    // ── 1. Upsert the account row ──
    if (account) {
      const { error: accErr } = await supabase.from('accounts')
        .update({ email: cleanEmail, platform: cleanPlatform, type: cleanType, notes: combinedNotes || null })
        .eq('id', accId)
      if (accErr) { setError(accErr.message); setLoading(false); return }
    } else {
      const { data: newAcc, error: accErr } = await supabase.from('accounts')
        .insert({ user_id: user.id, email: cleanEmail, platform: cleanPlatform, type: cleanType, notes: combinedNotes || null })
        .select().single()
      if (accErr) { setError(accErr.message); setLoading(false); return }
      accId = newAcc.id
    }
    setAccountTags(accId, tags)

    // ── 2. Handle icon ──
    if (iconFile) {
      try {
        const base64 = await resizeImageToBase64(iconFile, 128)
        const { error: urlErr } = await supabase.from('accounts').update({ icon_url: base64 }).eq('id', accId)
        if (urlErr) { setError(`Could not save icon: ${urlErr.message}`); setLoading(false); return }
      } catch {
        setError('Could not process image.'); setLoading(false); return
      }
    }

    // ── 3. Handle timers ──
    const savedTimerIds = []

    for (const t of timers) {
      const days = parseInt(t.interval_days) || 0
      const hours = parseInt(t.interval_hours) || 0
      const newTotalHours = (days * 24) + hours

      if (newTotalHours > 0) {
        let nextDue
        if (!t.id) {
          // Requirement: New timers start as Ready (next_due_at = now, last_refreshed_at = null)
          nextDue = new Date().toISOString()
        } else {
          // Existing timers: ALWAYS preserve originalNextDueAt, even when interval_hours is edited
          nextDue = t.originalNextDueAt || new Date().toISOString()
        }

        const timerData = {
          account_id: accId,
          model_name: t.model_name,
          group_name: t.group_name || null,
          color: t.color || '#2563eb',
          interval_hours: newTotalHours,
          next_due_at: nextDue,
          notify_on_ready: Boolean(t.notify_on_ready),
        }
        if (!t.id) {
          timerData.last_refreshed_at = null
        }

        if (t.id) {
          await supabase.from('token_timers').update(timerData).eq('id', t.id)
          savedTimerIds.push(t.id)
        } else {
          const { data } = await supabase.from('token_timers').insert(timerData).select().single()
          if (data) savedTimerIds.push(data.id)
        }
      } else if (t.id) {
        // User cleared the interval — remove the timer
        await supabase.from('token_timers').delete().eq('id', t.id)
      }
    }

    // ── 4. Remove any timers the user deleted from the UI ──
    if (account?.token_timers) {
      for (const oldT of account.token_timers) {
        if (!savedTimerIds.includes(oldT.id)) {
          await supabase.from('token_timers').delete().eq('id', oldT.id)
        }
      }
    }

    setLoading(false)
    onSave(form.email)
    onClose()
  }

  function updateTimer(index, field, value) {
    setTimers(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function handleSelectPreset(index, presetId) {
    const preset = availablePresets.find(p => p.id === presetId)
    if (!preset) return

    setTimers(prev => {
      const next = [...prev]
      const groupName = preset.group_name || next[index].group_name
      const notify = preset.notify_on_ready ?? (preset.total_hours >= 24)
      next[index] = {
        ...next[index],
        presetId: preset.id,
        model_name: preset.model_name || next[index].model_name,
        group_name: groupName,
        interval_days: preset.interval_days !== undefined ? String(preset.interval_days) : next[index].interval_days,
        interval_hours: preset.interval_hours !== undefined ? String(preset.interval_hours) : next[index].interval_hours,
        color: preset.color || next[index].color,
        notify_on_ready: notify,
      }
      // Synchronize notify_on_ready across other timers in the same group
      if (groupName) {
        for (let i = 0; i < next.length; i++) {
          if ((next[i].group_name || next[i].model_name) === groupName) {
            next[i].notify_on_ready = notify
          }
        }
      }
      return next
    })
  }

  function handleToggleGroupNotification(targetGroup, enabled) {
    const key = (targetGroup || '').trim().toLowerCase()
    setTimers(prev => prev.map(t => {
      const g = (t.group_name || t.model_name || '').trim().toLowerCase()
      if (g === key || (!key && !g)) {
        return { ...t, notify_on_ready: enabled }
      }
      return t
    }))
  }

  function handleAddAntigravityBundle() {
    setTimers(prev => {
      const isSingleDefault = prev.length === 1 && !prev[0].interval_days && !prev[0].interval_hours && (prev[0].model_name === 'Model' || !prev[0].model_name)
      const baseTimers = isSingleDefault ? [] : prev

      // Skip any preset whose model_name or group_name (with model fallback) already exists
      const toAdd = ANTIGRAVITY_4_PRESETS.filter(p => {
        const alreadyExists = baseTimers.some(existing => {
          const existingGroup = (existing.group_name || existing.model_name || '').trim().toLowerCase()
          const presetGroup = (p.group_name || p.model_name || '').trim().toLowerCase()
          const existingModel = (existing.model_name || '').trim().toLowerCase()
          const presetModel = p.model_name.toLowerCase()
          return existingModel === presetModel || (existingGroup === presetGroup && existingModel === presetModel)
        })
        return !alreadyExists
      }).map(p => ({
        ...createTimerFromPreset(p),
        id: null,
        originalIntervalHours: null,
        originalNextDueAt: null,
        // Since Gemini and Claude/GPT are weekly groups in the bundle, their group alert defaults to true
        notify_on_ready: true,
      }))

      if (toAdd.length === 0) return prev
      return [...baseTimers, ...toAdd]
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-lg overflow-y-auto max-h-[90vh] p-4 sm:p-6 rounded-2xl">
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
          {/* Email */}
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" required className={inputCls} placeholder="account@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          {/* Unified Platform Category Quick-Select */}
          <div>
            <label className={labelCls}>AI Platform Category <span className="font-normal text-muted-foreground">(click to unify name &amp; logo)</span></label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {AI_PLATFORM_CATALOG.map(preset => {
                const isSelected = resolveUnifiedPlatform(form.platform).id === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, platform: preset.name, type: preset.category }))}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <UnifiedPlatformIcon platform={preset.name} type={preset.category} size="sm" className="w-4 h-4 rounded text-[9px]" />
                    <span>{preset.name}</span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2.5 items-start">
              <div>
                <label className={labelCls}>Platform Name</label>
                <input type="text" required className={inputCls} placeholder="e.g. Antigravity IDE 2.0"
                  value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <input type="text" required className={inputCls} placeholder="e.g. Coding"
                  value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
              </div>
              <div className="flex flex-col items-center">
                <label className={labelCls}>Logo</label>
                <label className="cursor-pointer group flex flex-col items-center justify-center w-[40px] h-[40px] rounded-xl border border-input bg-background overflow-hidden relative shrink-0 hover:border-primary transition-colors" title="Upload custom logo (shared across platform)">
                  {iconPreview ? (
                    <img src={iconPreview} alt="icon" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
                  ) : form.platform ? (
                    <UnifiedPlatformIcon platform={form.platform} type={form.type} size="md" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files[0]
                    if (file) { setIconFile(file); setIconPreview(URL.createObjectURL(file)) }
                  }} />
                </label>
              </div>
            </div>
          </div>

          {/* Custom Tags */}
          <div>
            <label className={labelCls}>
              Account Tags <span className="font-normal text-muted-foreground">(e.g. #Work, #Personal, #Team-A)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGGESTED_TAGS.map(st => {
                const active = tags.includes(st)
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => (active ? handleRemoveTag(st) : handleAddTag(st))}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Tag className="w-2.5 h-2.5" />
                    <span>#{st}</span>
                  </button>
                )
              })}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
                  >
                    <span>#{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type custom tag (e.g. Client-X) and press Add..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag(tagInput)
                  }
                }}
                className={`${inputCls} py-1.5 text-xs flex-1`}
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                className="px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs font-semibold text-foreground"
              >
                + Tag
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes <span className="text-slate-400">(optional)</span></label>
            <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Any notes…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* ── Timers section ── */}
          <div className="border-t border-border/50 pt-5 mt-1 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Token Cooldown Timers <span className="font-normal normal-case">(optional)</span>
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleAddAntigravityBundle}
                  className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                  title="Adds Gemini Weekly, Gemini 5h, Claude/GPT Weekly, and Claude/GPT 5h">
                  <Sparkles className="w-3 h-3" /> Add 4 Antigravity Timers
                </button>
                <button type="button" onClick={() => setTimers(t => [...t, emptyTimer()])}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-500 hover:text-blue-400 transition-colors">
                  <Plus className="w-3 h-3" /> Add Model
                </button>
              </div>
            </div>

            {timers.map((t, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border bg-muted/20 relative space-y-3" style={{ borderColor: 'var(--border)' }}>
                {/* Delete button */}
                {timers.length > 1 && (
                  <button type="button" onClick={() => setTimers(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Preset selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Preset Template</label>
                    <button
                      type="button"
                      onClick={() => {
                        const created = saveCustomPreset({
                          model_name: t.model_name || 'Custom Model',
                          group_name: t.group_name || t.model_name || 'Custom Group',
                          interval_days: t.interval_days || 0,
                          interval_hours: t.interval_hours || 5,
                          color: t.color || '#2563eb',
                          notify_on_ready: t.notify_on_ready,
                        })
                        setAvailablePresets(getAllTimerPresets())
                        updateTimer(idx, 'presetId', created.id)
                        setSavedPresetFeedback(idx)
                        setTimeout(() => setSavedPresetFeedback(null), 2000)
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                      title="Save current model timer configuration as a reusable preset"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      {savedPresetFeedback === idx ? 'Saved to Presets!' : 'Save as Custom Preset'}
                    </button>
                  </div>
                  <select 
                    className={`${inputCls} py-2 text-xs`}
                    value={t.presetId || ''}
                    onChange={e => handleSelectPreset(idx, e.target.value)}
                  >
                    <option value="">Choose preset (or customize below)...</option>
                    {availablePresets.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Model Name + Group Name + Color swatch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                  <div>
                    <label className={labelCls}>Model Name</label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        color={t.color || '#2563eb'}
                        onChange={c => updateTimer(idx, 'color', c)}
                      />
                      <input type="text" className={`${inputCls} flex-1`} placeholder="e.g. Gemini Weekly"
                        value={t.model_name} onChange={e => updateTimer(idx, 'model_name', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Group Name <span className="text-[10px] lowercase text-muted-foreground">(e.g. Gemini)</span></label>
                    <input type="text" className={inputCls} placeholder="e.g. Gemini, Claude / GPT"
                      value={t.group_name || ''} onChange={e => updateTimer(idx, 'group_name', e.target.value)} />
                  </div>
                </div>

                {/* Interval inputs */}
                <div>
                  <label className={labelCls}>Reset / Cooldown Interval</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input type="number" min="0" className={inputCls} placeholder="Days"
                        value={t.interval_days} onChange={e => updateTimer(idx, 'interval_days', e.target.value)} />
                      <span className="text-[10px] text-muted-foreground mt-1 block text-center">days</span>
                    </div>
                    <div>
                      <input type="number" min="0" max="23" className={inputCls} placeholder="Hours"
                        value={t.interval_hours} onChange={e => updateTimer(idx, 'interval_hours', e.target.value)} />
                      <span className="text-[10px] text-muted-foreground mt-1 block text-center">hours</span>
                    </div>
                  </div>
                </div>

                {/* ── Per-Group Notification Toggle ── */}
                <div className="flex items-center justify-between pt-2.5 pb-0.5 border-t border-border/40">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Bell className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground truncate">
                      Email alert when group is ready
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      ({t.group_name || t.model_name || 'Group'})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleGroupNotification(t.group_name || t.model_name, !t.notify_on_ready)}
                    className="shrink-0 w-8 h-4.5 rounded-full transition-colors relative"
                    style={{ background: t.notify_on_ready ? 'var(--ap-accent)' : 'var(--border)' }}
                    title={t.notify_on_ready ? "Email notification enabled for this group" : "Email notification disabled for this group"}
                  >
                    <span
                      className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: t.notify_on_ready ? 'translateX(16px)' : 'translateX(2px)' }}
                    />
                  </button>
                </div>

                {/* ── Current timer status (read-only, only shown when editing) ── */}
                {(() => {
                  const remaining = t.originalNextDueAt ? formatRemaining(t.originalNextDueAt) : null
                  const currentTotal = ((parseInt(t.interval_days) || 0) * 24) + (parseInt(t.interval_hours) || 0)
                  const intervalChanged = t.originalIntervalHours !== null && currentTotal > 0 && currentTotal !== t.originalIntervalHours

                  return (
                    <>
                      {/* Read-only current timer display */}
                      {remaining && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                          style={{
                            background: remaining.expired
                              ? 'color-mix(in srgb, #ef4444 8%, var(--muted))'
                              : 'color-mix(in srgb, var(--muted) 50%, transparent)',
                          }}>
                          <Clock className="w-3 h-3 shrink-0" style={{ color: remaining.expired ? '#ef4444' : 'var(--muted-foreground)' }} />
                          <span className="text-[11px] font-medium"
                            style={{ color: remaining.expired ? '#ef4444' : 'var(--muted-foreground)' }}>
                            Current timer:{' '}
                            <span className="font-semibold" style={{ color: remaining.expired ? '#ef4444' : 'var(--foreground)' }}>
                              {remaining.text}
                            </span>
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            ))}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center gap-3 justify-end pt-3 border-t border-border mt-4">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
