/**
 * Timer presets for quick creation in AccountModal
 */

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
    notify_on_ready: true, // Weekly group: opt-in ON by default
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
    notify_on_ready: false, // 5-hour group: opt-in OFF by default
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
    notify_on_ready: true, // Weekly group: opt-in ON by default
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
    notify_on_ready: false, // 5-hour group: opt-in OFF by default
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
  }
]

/**
 * The 4 Antigravity presets bundled together
 */
export const ANTIGRAVITY_4_PRESETS = [
  TIMER_PRESETS[0], // Gemini Weekly (notify_on_ready: true)
  TIMER_PRESETS[1], // Gemini 5-hour (notify_on_ready: false)
  TIMER_PRESETS[2], // Claude/GPT Weekly (notify_on_ready: true)
  TIMER_PRESETS[3], // Claude/GPT 5-hour (notify_on_ready: false)
]

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
    notify_on_ready: preset.notify_on_ready ?? false
  }
}
