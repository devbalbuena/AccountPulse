import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import CountdownTimer from '@/components/CountdownTimer'
import AccountModal from '@/components/AccountModal'
import { Search, Pencil, Archive } from 'lucide-react'

const thCls = "px-4 py-3 text-[11px] font-semibold tracking-wider uppercase text-left border-b"
const tdCls = "px-4 py-3.5 text-sm border-b align-middle"

export default function AccountsIndex() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('accounts').select('*, token_timers(*)')
      .is('deleted_at', null).eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setAccounts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleArchive(id) {
    if (!confirm('Archive this account?')) return
    await supabase.from('accounts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function handleMarkRefreshed(timerId, intervalHours, platform, email) {
    const now = new Date()
    const nextDue = new Date(now.getTime() + intervalHours * 3600000)
    await supabase.from('token_timers').update({ last_refreshed_at: now.toISOString(), next_due_at: nextDue.toISOString() }).eq('id', timerId)
    
    await supabase.from('notifications').insert({
      user_id: user.id,
      message: `You refreshed the token for ${platform} account ${email}`,
      is_read: false
    })
    
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          acc.platform.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (filterType !== 'All') return acc.type === filterType
    return true
  })

  const types = ['All', ...new Set(accounts.map(a => a.type))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Accounts</h2>
        <div className="flex items-center gap-3">
          <Link to="/accounts/archived"
            className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            Archived
          </Link>
          <button onClick={() => { setEditingAccount(null); setIsModalOpen(true); }}
            className="px-4 py-2 text-sm rounded-xl text-white font-semibold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)' }}>
            + Add Account
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-20 px-4 text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-5xl mb-4 opacity-10 select-none">◎</div>
          <p className="font-medium" style={{ color: 'var(--muted-foreground)' }}>No accounts yet</p>
          <button onClick={() => { setEditingAccount(null); setIsModalOpen(true) }}
            className="mt-2 text-sm hover:underline" style={{ color: 'var(--ap-accent)' }}>Add your first account →</button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search by email or platform..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring" 
              />
            </div>
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full sm:w-auto bg-background border border-input text-sm rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {types.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
            </select>
          </div>
          
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'color-mix(in srgb, var(--muted) 50%, transparent)' }}>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Email</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Platform</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Type</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Token Timer</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Interval</th>
                <th className={`${thCls} text-right`} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map(acc => {
                const timer = acc.token_timers?.[0]
                return (
                   <tr key={acc.id} className="group transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--muted) 30%, transparent)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', color: 'var(--foreground)', fontWeight: 500 }}>{acc.email}</td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)' }}>
                      <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--ap-accent) 12%, transparent)', color: 'var(--ap-accent)' }}>
                        {acc.platform}
                      </span>
                    </td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>{acc.type}</td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)' }}>
                      <CountdownTimer 
                        nextDueAt={timer?.next_due_at} 
                        accountId={acc.id}
                        platform={acc.platform}
                        email={acc.email}
                        userId={user.id}
                      />
                    </td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', fontSize: '12px' }}>
                      {timer ? `Every ${timer.interval_hours}h` : '—'}
                    </td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-2">
                        {timer && (
                          <button onClick={() => handleMarkRefreshed(timer.id, timer.interval_hours, acc.platform, acc.email)}
                            className="text-[11px] px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-md hover:bg-emerald-500/20 transition-colors mr-2">
                            Refreshed
                          </button>
                        )}
                        <button onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleArchive(acc.id)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Archive">
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <AccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        account={editingAccount} 
        onSave={() => load()} 
      />
    </div>
  )
}
