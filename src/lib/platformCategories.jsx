import React from 'react'

export const AI_PLATFORM_CATALOG = [
  {
    id: 'antigravity',
    name: 'Antigravity IDE 2.0',
    category: 'Coding',
    color: '#2563eb',
    aliases: ['antigravity', 'antigravity ide', 'antigravity ide 2.0', 'google antigravity', 'agy'],
  },
  {
    id: 'claude',
    name: 'Claude AI',
    category: 'AI Assistant',
    color: '#d97757',
    aliases: ['claude', 'claude ai', 'claude pro', 'anthropic'],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    category: 'AI Assistant',
    color: '#10a37f',
    aliases: ['chatgpt', 'chatgpt plus', 'openai', 'gpt'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'AI Assistant',
    color: '#4f46e5',
    aliases: ['gemini', 'google gemini', 'gemini advanced', 'google ai', 'google ai pro'],
  },
  {
    id: 'cursor',
    name: 'Cursor IDE',
    category: 'Coding',
    color: '#0f172a',
    aliases: ['cursor', 'cursor ide', 'cursor pro'],
  },
  {
    id: 'windsurf',
    name: 'Windsurf IDE',
    category: 'Coding',
    color: '#0891b2',
    aliases: ['windsurf', 'windsurf ide', 'codeium'],
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    category: 'Coding',
    color: '#334155',
    aliases: ['copilot', 'github copilot'],
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    category: 'AI Search',
    color: '#0d9488',
    aliases: ['perplexity', 'perplexity ai', 'perplexity pro'],
  },
]

const FALLBACK_PALETTE = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777']

export function hashColor(name = '') {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return FALLBACK_PALETTE[sum % FALLBACK_PALETTE.length]
}

/**
 * Normalizes a raw platform string & type into a unified canonical platform object.
 * Also searches `allAccounts` so that if any account of the same platform has an uploaded `icon_url`,
 * all accounts of that platform share the unified logo automatically.
 */
export function resolveUnifiedPlatform(rawPlatform, rawType = '', allAccounts = [], ownIconUrl = '') {
  const cleaned = (rawPlatform || '').trim().replace(/\s+/g, ' ')
  const lower = cleaned.toLowerCase()

  let matched = AI_PLATFORM_CATALOG.find(
    p => p.name.toLowerCase() === lower || p.id === lower || p.aliases.includes(lower)
  )

  if (!matched && lower) {
    if (lower.includes('antigravity')) matched = AI_PLATFORM_CATALOG[0]
    else if (lower.includes('claude') || lower.includes('anthropic')) matched = AI_PLATFORM_CATALOG[1]
    else if (lower.includes('chatgpt') || lower.includes('openai')) matched = AI_PLATFORM_CATALOG[2]
    else if (lower.includes('gemini')) matched = AI_PLATFORM_CATALOG[3]
    else if (lower.includes('cursor')) matched = AI_PLATFORM_CATALOG[4]
    else if (lower.includes('windsurf')) matched = AI_PLATFORM_CATALOG[5]
    else if (lower.includes('copilot')) matched = AI_PLATFORM_CATALOG[6]
    else if (lower.includes('perplexity')) matched = AI_PLATFORM_CATALOG[7]
  }

  const canonicalName = matched ? matched.name : (cleaned || 'Uncategorized')
  const canonicalKey = matched ? matched.id : canonicalName.toLowerCase()
  const category = (rawType || '').trim() || (matched ? matched.category : 'General')
  const color = matched ? matched.color : hashColor(canonicalName)

  // Find shared icon_url across any account belonging to this same canonical platform
  let unifiedIconUrl = ownIconUrl || ''
  if (!unifiedIconUrl && Array.isArray(allAccounts) && allAccounts.length > 0) {
    const donor = allAccounts.find(a => {
      if (!a?.icon_url) return false
      const aClean = (a.platform || '').trim().replace(/\s+/g, ' ').toLowerCase()
      if (matched) {
        return (
          aClean === matched.name.toLowerCase() ||
          matched.aliases.includes(aClean) ||
          aClean.includes(matched.id)
        )
      }
      return aClean === canonicalKey
    })
    if (donor) unifiedIconUrl = donor.icon_url
  }

  return {
    key: canonicalKey,
    id: matched?.id || null,
    name: canonicalName,
    category,
    color,
    iconUrl: unifiedIconUrl,
  }
}

/**
 * Renders a unified platform brand icon (uses shared uploaded icon_url if present,
 * otherwise renders a crisp vector SVG mark for known AI platforms).
 */
export function UnifiedPlatformIcon({ platform, type, allAccounts, iconUrl, size = 'md', className = '' }) {
  const info = resolveUnifiedPlatform(platform, type, allAccounts, iconUrl)
  const dims = size === 'sm' ? 'w-6 h-6 text-xs rounded-md' : size === 'lg' ? 'w-10 h-10 text-sm rounded-xl' : 'w-8 h-8 text-xs rounded-lg'

  if (info.iconUrl) {
    return (
      <img
        src={info.iconUrl}
        alt={info.name}
        className={`${dims} object-cover shrink-0 border border-border/60 ${className}`}
      />
    )
  }

  if (info.id === 'antigravity') {
    return (
      <div
        className={`${dims} shrink-0 flex items-center justify-center bg-slate-950 text-white shadow-xs border border-slate-800 ${className}`}
        title={info.name}
      >
        <svg viewBox="0 0 24 24" className="w-4/6 h-4/6" fill="none">
          <path d="M12 3L4 20h3.5l4.5-10 4.5 10H20L12 3z" fill="url(#ag-grad)" />
          <defs>
            <linearGradient id="ag-grad" x1="4" y1="20" x2="20" y2="3" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3b82f6" />
              <stop offset="0.5" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#f97316" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (info.id === 'claude') {
    return (
      <div
        className={`${dims} shrink-0 flex items-center justify-center text-white font-bold shadow-xs ${className}`}
        style={{ background: '#d97757' }}
        title={info.name}
      >
        ✦
      </div>
    )
  }

  if (info.id === 'chatgpt') {
    return (
      <div
        className={`${dims} shrink-0 flex items-center justify-center text-white font-bold shadow-xs ${className}`}
        style={{ background: '#10a37f' }}
        title={info.name}
      >
        ◎
      </div>
    )
  }

  if (info.id === 'gemini') {
    return (
      <div
        className={`${dims} shrink-0 flex items-center justify-center text-white font-bold shadow-xs ${className}`}
        style={{ background: 'linear-gradient(135deg, #4f46e5, #06b6d4)' }}
        title={info.name}
      >
        ✦
      </div>
    )
  }

  const initial = info.name?.[0]?.toUpperCase() || '?'
  return (
    <div
      className={`${dims} shrink-0 flex items-center justify-center text-white font-bold shadow-xs ${className}`}
      style={{ background: info.color }}
      title={info.name}
    >
      {initial}
    </div>
  )
}
