import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  Sun, Moon, LogOut, Bell, Search, Settings,
  LayoutGrid, Users, CreditCard, BarChart2, ChevronLeft, ChevronRight, X
} from 'lucide-react'

const NAV_ITEMS = [
  {
    to: '/dashboard', label: 'Dashboard',
    icon: <LayoutGrid className="w-4.5 h-4.5 shrink-0" />
  },
  {
    to: '/accounts', label: 'Accounts',
    icon: <Users className="w-4.5 h-4.5 shrink-0" />
  },
  {
    to: '/subscriptions', label: 'Subscriptions',
    icon: <CreditCard className="w-4.5 h-4.5 shrink-0" />
  },
  {
    to: '/reports', label: 'Reports',
    icon: <BarChart2 className="w-4.5 h-4.5 shrink-0" />
  },
]

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AppLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notifRef = useRef(null)
  const profileRef = useRef(null)

  async function loadNotifications() {
    if (!user) return
    const [{ count }, { data }] = await Promise.all([
      supabase.from('notifications').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_read', false),
      supabase.from('notifications').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    ])
    setUnreadCount(count || 0)
    setNotifications(data || [])
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [user])

  async function markAllRead() {
    if (!user) return
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false)
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Close notif panel on outside click
  useEffect(() => {
    function handle(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [notifOpen])

  // Close profile dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    if (profileOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [profileOpen])

  const avatarLetter = user?.email?.[0]?.toUpperCase() || '?'
  const sidebarW = collapsed ? 'w-16' : 'w-[200px]'

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>

      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarW} fixed inset-y-0 left-0 z-20 flex flex-col py-4 border-r transition-all duration-300 ease-in-out`}
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-4 mb-7 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)' }}>
            <span className="text-white text-xs font-black">AP</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Account<span style={{ color: 'var(--ap-accent)' }}>Pulse</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 px-2 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'text-white shadow-sm'
                  : ''
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--ap-accent) 30%, transparent)'
              } : {}}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? 'white' : 'var(--muted-foreground)' }}
                    className="group-hover:text-foreground transition-colors">
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span style={{ color: isActive ? 'white' : 'var(--muted-foreground)' }}
                      className="group-hover:text-foreground transition-colors">
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Controls */}
        <div className="px-2 mt-4 flex flex-col gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-muted ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--muted-foreground)' }}
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5 shrink-0" /> : <Moon className="w-4.5 h-4.5 shrink-0" />}
            {!collapsed && <span>Theme</span>}
          </button>

          {/* Divider */}
          <div className="h-px my-1" style={{ background: 'var(--border)' }} />

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-muted ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--muted-foreground)' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4.5 h-4.5 shrink-0" /> : <ChevronLeft className="w-4.5 h-4.5 shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Right Panel (Top Bar + Content) ── */}
      <div 
        className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? '64px' : '200px' }}
      >

        {/* Top Bar */}
        <header className="h-14 shrink-0 flex items-center gap-4 px-6 border-b"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

          {/* Search */}
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                '--tw-ring-color': 'var(--ap-accent)'
              }}
            />
          </div>

          <div className="flex items-center gap-1 ml-auto">

            {/* Notifications Bell */}
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="p-2 rounded-lg transition-colors hover:bg-muted relative"
              style={{ color: 'var(--muted-foreground)' }}
              title="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ background: 'var(--ap-accent)' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Avatar + Dropdown */}
            <div className="relative ml-1" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                title={`Signed in as ${user?.email}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition-opacity hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, var(--ap-accent), #c084fc)' }}
              >
                {avatarLetter}
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-60 rounded-xl border shadow-xl z-50 overflow-hidden"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  {/* Header */}
                  <div className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {user?.email}
                    </p>
                  </div>

                  {/* Nav Links */}
                  <div className="py-1">
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-muted"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <Settings className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                      Account Settings
                    </Link>
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-muted text-left"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <span className="w-4 h-4 flex items-center justify-center text-xs" style={{ color: 'var(--muted-foreground)' }}>?</span>
                      Help & Support
                    </button>
                  </div>

                  {/* Divider + Sign Out */}
                  <div className="border-t py-1" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => { setProfileOpen(false); handleLogout() }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-500/10 text-left text-red-500"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Slide-in Notifications Panel ── */}
      {/* Backdrop */}
      {notifOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.2)' }}
          onClick={() => setNotifOpen(false)}
        />
      )}
      {/* Panel */}
      <div
        ref={notifRef}
        className="fixed top-0 right-0 h-full w-80 z-40 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out"
        style={{
          background: 'var(--card)',
          borderLeft: '1px solid var(--border)',
          transform: notifOpen ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{unreadCount} unread</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-medium px-2 py-1 rounded-md hover:bg-muted transition-colors"
                style={{ color: 'var(--ap-accent)' }}>
                Mark all read
              </button>
            )}
            <button onClick={() => setNotifOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              style={{ color: 'var(--muted-foreground)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
              <Bell className="w-10 h-10 mb-3" style={{ color: 'var(--border)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No notifications yet</p>
            </div>
          ) : (
            <ul>
              {notifications.map(n => (
                <li key={n.id} className="px-5 py-3.5 border-b transition-colors hover:bg-muted/30"
                  style={{ borderColor: 'var(--border)', opacity: n.is_read ? 0.6 : 1 }}>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ background: n.is_read ? 'var(--border)' : 'var(--ap-accent)' }} />
                    <div className="min-w-0">
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{n.message}</p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
