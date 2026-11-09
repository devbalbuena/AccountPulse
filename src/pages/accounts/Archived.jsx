import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { UnifiedPlatformIcon } from '@/lib/platformCategories'
import {
  Archive,
  RotateCcw,
  Trash2,
  Search,
  CheckSquare,
  Square,
  ArrowLeft,
  Users,
  CreditCard,
} from 'lucide-react'

export default function AccountsArchived() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('accounts')
      .select('*, token_timers(*)')
      .not('deleted_at', 'is', null)
      .eq('user_id', user.id)
      .order('deleted_at', { ascending: false })
    setAccounts(data || [])
    setSelectedIds([])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user])

  function toggleSelect(id) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  async function handleRestore(id) {
    await supabase.from('accounts').update({ deleted_at: null }).eq('id', id)
    addToast({ type: 'success', message: 'Account restored to active fleet' })
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Permanently purge this account and its timers? This cannot be undone.')) return
    await supabase.from('token_timers').delete().eq('account_id', id)
    await supabase.from('accounts').delete().eq('id', id)
    addToast({ type: 'info', message: 'Account permanently purged' })
    load()
  }

  async function handleBatchRestore() {
    if (selectedIds.length === 0) return
    await supabase.from('accounts').update({ deleted_at: null }).in('id', selectedIds)
    addToast({ type: 'success', message: `Restored ${selectedIds.length} account(s)` })
    load()
  }

  async function handleBatchPurge() {
    if (selectedIds.length === 0) return
    if (!confirm(`Permanently purge ${selectedIds.length} archived account(s)? This cannot be undone.`)) return
    await supabase.from('token_timers').delete().in('account_id', selectedIds)
    await supabase.from('accounts').delete().in('id', selectedIds)
    addToast({ type: 'info', message: `Permanently purged ${selectedIds.length} account(s)` })
    load()
  }

  const filtered = accounts.filter(acc => {
    const q = search.toLowerCase()
    return (
      acc.email.toLowerCase().includes(q) ||
      (acc.platform || '').toLowerCase().includes(q) ||
      (acc.type || '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header & Suite Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/accounts"
            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Back to Active Accounts"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Archive Management Suite</h1>
            <p className="text-xs text-muted-foreground">
              Inspect, batch restore, or permanently purge archived accounts and subscriptions
            </p>
          </div>
        </div>

        {/* Suite Tabs */}
        <div className="inline-flex p-0.5 rounded-lg border border-border bg-muted/50 self-start sm:self-auto">
          <Link
            to="/accounts/archived"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-card text-foreground shadow-xs border border-border/60"
          >
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Archived Accounts ({accounts.length})</span>
          </Link>
          <Link
            to="/subscriptions/archived"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Archived Subscriptions</span>
          </Link>
        </div>
      </div>

      {/* Search & Batch Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter archived accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === filtered.length ? [] : filtered.map(a => a.id)
                )
              }
              className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              {selectedIds.length === filtered.length ? 'Deselect All' : `Select All (${filtered.length})`}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleBatchRestore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Selected ({selectedIds.length})</span>
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleBatchPurge}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Selected</span>
            </button>
          </div>
        )}
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 px-4 text-center shadow-xs">
          <Archive className="w-9 h-9 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-foreground">No archived accounts found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Accounts you archive from the main fleet will appear here for restoration or permanent removal.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 w-10">Select</th>
                <th className="py-3 px-4">Account Email</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Archived Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(acc => {
                const isSelected = selectedIds.includes(acc.id)
                return (
                  <tr key={acc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSelect(acc.id)}
                        className="text-primary flex items-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                      {acc.email}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <UnifiedPlatformIcon
                          platform={acc.platform}
                          type={acc.type}
                          allAccounts={accounts}
                          iconUrl={acc.icon_url}
                          size="sm"
                        />
                        <span className="font-semibold text-foreground">{acc.platform}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{acc.type || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground tabular-nums whitespace-nowrap">
                      {new Date(acc.deleted_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => handleRestore(acc.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold hover:opacity-90"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(acc.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-semibold hover:opacity-90"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Purge</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
