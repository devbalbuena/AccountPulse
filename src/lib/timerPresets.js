/**
 * Timer presets for quick creation in AccountModal & Custom Timer Preset Manager in Settings
 */

const CUSTOM_PRESETS_KEY = 'ap_custom_timer_presets'

export const TIMER_PRESETS = [
  {
    id: 'antigravity_gemini_weekly',
    label: 'Antigravity - Gemini Weekly (167h)',
    model_name: 'Gemini Weekly',
    group_name: 'Gemini',
    interval_days: 6,
    interval_hours: 23,
    total_hours: 167,
    color: '#10b981', // Emerald
    isCustom: false,
    notify_on_ready: true,
  },
  {
    id: 'antigravity_gemini_5h',
    label: 'Antigravity - Gemini 5-hour (5h)',
    model_name: 'Gemini 5-hour',
    group_name: 'Gemini',
    interval_days: 0,
    interval_hours: 5,
    total_hours: 5,
    color: '#06b6d4', // Cyan
    isCustom: false,
    notify_on_ready: false,
  },
  {
    id: 'antigravity_claude_weekly',
    label: 'Antigravity - Claude/GPT Weekly (167h)',
    model_name: 'Claude/GPT Weekly',
    group_name: 'Claude / GPT',
    interval_days: 6,
    interval_hours: 23,
    total_hours: 167,
    color: '#8b5cf6', // Purple
    isCustom: false,
    notify_on_ready: true,
  },
  {
    id: 'antigravity_claude_5h',
    label: 'Antigravity - Claude/GPT 5-hour (5h)',
    model_name: 'Claude/GPT 5-hour',
    group_name: 'Claude / GPT',
    interval_days: 0,
    interval_hours: 5,
    total_hours: 5,
    color: '#ec4899', // Pink
    isCustom: false,
    notify_on_ready: false,
  },
  {
    id: 'chatgpt_image',
    label: 'ChatGPT Image (Custom hours)',
    model_name: 'ChatGPT Image',
    group_name: 'ChatGPT',
    interval_days: 0,
    interval_hours: '',
    total_hours: 0,
    color: '#f59e0b', // Amber
    isCustom: true,
    notify_on_ready: false,
  },
  {
    id: 'custom',
    label: 'Custom Model...',
    model_name: '',
    group_name: '',
    interval_days: '',
    interval_hours: '',
    total_hours: 0,
    color: '#2563eb', // Indigo/Blue
    isCustom: true,
    notify_on_ready: false,
  },
]

/**
 * The 4 Antigravity presets bundled together
 */
export const ANTIGRAVITY_4_PRESETS = [
  TIMER_PRESETS[0],
  TIMER_PRESETS[1],
  TIMER_PRESETS[2],
  TIMER_PRESETS[3],
]

/**
 * Retrieves user-defined custom timer presets from localStorage
 */
export function getCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Saves or updates a custom timer preset
 */
export function saveCustomPreset({
  id,
  model_name,
  group_name,
  interval_days = 0,
  interval_hours = 0,
  color = '#2563eb',
  notify_on_ready = false,
}) {
  const days = Math.max(0, parseInt(interval_days) || 0)
  const hours = Math.max(0, parseInt(interval_hours) || 0)
  const totalHours = days * 24 + hours
  const cleanModel = (model_name || 'Custom Model').trim()
  const cleanGroup = (group_name || cleanModel).trim()

  const newPreset = {
    id: id || `user_preset_${Date.now()}`,
    label: `★ ${cleanGroup} — ${cleanModel} (${totalHours}h)`,
    model_name: cleanModel,
    group_name: cleanGroup,
    interval_days: days,
    interval_hours: hours,
    total_hours: totalHours,
    color: color || '#2563eb',
    isCustom: false,
    isUserPreset: true,
    notify_on_ready: Boolean(notify_on_ready),
  }

  const existing = getCustomPresets()
  const idx = existing.findIndex(p => p.id === newPreset.id)
  let updated
  if (idx >= 0) {
    updated = [...existing]
    updated[idx] = newPreset
  } else {
    updated = [newPreset, ...existing]
  }
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated))
  return newPreset
}

/**
 * Deletes a user-defined custom timer preset by ID
 */
export function deleteCustomPreset(id) {
  const existing = getCustomPresets().filter(p => p.id !== id)
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(existing))
  return existing
}

/**
 * Returns all presets (user custom presets first, followed by built-in presets)
 */
export function getAllTimerPresets() {
  return [...getCustomPresets(), ...TIMER_PRESETS]
}

/**
 * Creates a timer state object from a preset definition
 */
export function createTimerFromPreset(preset) {
  return {
    id: null,
    model_name: preset.model_name || '',
    group_name: preset.group_name || '',
    color: preset.color || '#2563eb',
    interval_days: preset.interval_days !== undefined ? String(preset.interval_days) : '',
    interval_hours: preset.interval_hours !== undefined ? String(preset.interval_hours) : '',
    originalIntervalHours: null,
    originalNextDueAt: null,
    showColorPicker: false,
    presetId: preset.id,
    notify_on_ready: preset.notify_on_ready ?? false,
  }
}
