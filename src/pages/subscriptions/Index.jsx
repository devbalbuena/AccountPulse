import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import DaysUntilBadge from '@/components/DaysUntilBadge'
import SubscriptionModal from '@/components/SubscriptionModal'
import { computeNextBillingDate } from '@/lib/subscriptionUtils'
import { Search, Pencil, Archive } from 'lucide-react'

const thCls = "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left border-b"
const tdCls = "px-4 py-3.5 text-sm border-b align-middle"

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SubscriptionsIndex() {
  const { user } = useAuth()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('subscriptions').select('*')
      .is('deleted_at', null).eq('user_id', user.id)
      .order('next_billing_date', { ascending: true })

    if (data && data.length > 0) {
      let changed = false
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      
      const updatedData = [...data]
      for (let i = 0; i < data.length; i++) {
        const sub = data[i]
        const nextBillDate = new Date(sub.next_billing_date)
        
        if (nextBillDate < now && sub.billing_day) {
           const newDate = computeNextBillingDate(sub.billing_day)
           if (new Date(newDate) > nextBillDate) {
             updatedData[i] = { ...sub, next_billing_date: newDate }
             supabase.from('subscriptions').update({ next_billing_date: newDate }).eq('id', sub.id).then(() => {}) // silently catch
             changed = true
           }
        }
      }
      
      if (changed) {
        updatedData.sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date))
        setSubs(updatedData)
        setLoading(false)
        return
      }
    }

    setSubs(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleArchive(id) {
    if (!confirm('Archive this subscription?')) return
    await supabase.from('subscriptions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const totalMonthly = subs.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--ap-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const filteredSubs = subs.filter(sub => {
    const matchesSearch = sub.service_name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Subscriptions</h2>
          {subs.length > 0 && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Total monthly: <span className="font-semibold" style={{ color: 'var(--ap-accent3)' }}>PHP {totalMonthly.toFixed(2)}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/subscriptions/archived"
            className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            Archived
          </Link>
          <button onClick={() => { setEditingSub(null); setIsModalOpen(true); }}
            className="px-4 py-2 text-sm rounded-xl text-white font-semibold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--ap-accent3), #34d399)' }}>
            + Add Subscription
          </button>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-20 px-4 text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-5xl mb-4 opacity-10 select-none">◈</div>
          <p className="font-medium" style={{ color: 'var(--muted-foreground)' }}>No subscriptions yet</p>
          <button onClick={() => { setEditingSub(null); setIsModalOpen(true) }}
            className="mt-2 text-sm hover:underline" style={{ color: 'var(--ap-accent)' }}>Add your first subscription →</button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              <input 
                type="text" 
                placeholder="Search by service..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1 transition-colors"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
            </div>
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full sm:w-auto text-sm rounded-lg px-3 py-2 border focus:outline-none"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="All">All Services</option>
            </select>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'color-mix(in srgb, var(--muted) 50%, transparent)' }}>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Service</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Billing Day</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Next Bill</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Status</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Amount</th>
                <th className={thCls} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Notes</th>
                <th className={`${thCls} text-right`} style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.map(sub => {
                const days = daysUntil(sub.next_billing_date)
                const urgent = days !== null && days <= 3
                return (
                  <tr key={sub.id} className="group transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--muted) 30%, transparent)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', fontWeight: 500, color: 'var(--foreground)' }}>
                      <div className="flex items-center gap-2">
                        {urgent && <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: '#ef4444' }} />}
                        {sub.service_name}
                      </div>
                    </td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>Day {sub.billing_day}</td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>{formatDate(sub.next_billing_date)}</td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)' }}><DaysUntilBadge days={days} /></td>
                    <td className={tdCls} style={{ borderColor: 'var(--border)', fontWeight: 600, color: 'var(--ap-accent3)' }}>
                      {sub.currency} {parseFloat(sub.amount).toFixed(2)}
                    </td>
                    <td className={`${tdCls} max-w-[160px] truncate`} style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', fontSize: '12px' }}>
                      {sub.notes || '—'}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditingSub(sub); setIsModalOpen(true); }}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleArchive(sub.id)}
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

      <SubscriptionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        subscription={editingSub} 
        onSave={() => load()} 
      />
    </div>
  )
}
