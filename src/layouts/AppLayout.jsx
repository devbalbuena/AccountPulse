import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { evaluateAccountStatus } from '@/lib/durationUtils'
import { useToast } from '@/context/ToastContext'
import { useNow } from '@/context/TimeContext'
import { checkGroupReadyTransitions, resetGroupReadyWatcher } from '@/lib/groupNotificationWatcher'
import {
  LayoutGrid, Users, CreditCard, BarChart2, ChevronLeft, ChevronRight, X, ChevronRight as ChevronRightIcon,
  Sun, Moon, Search, Bell, Settings, LogOut, AlertTriangle, Archive
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
  const { addToast } = useToast()
  const now = useNow()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)
  const [readyCount, setReadyCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('accountpulse_sidebar_collapsed')
    return saved !== null ? saved === 'true' : true
  })
  
  // Session Timeout State
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const timeoutTimerRef = useRef(null)
  const logoutTimerRef = useRef(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const notifRef = useRef(null)
  const profileRef = useRef(null)
  const accountsRef = useRef([])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    localStorage.setItem('accountpulse_sidebar_collapsed', collapsed.toString())
  }, [collapsed])

  const resetTimers = () => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    
    setShowTimeoutWarning(false)
    
    // 25 minutes warning
    timeoutTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true)
      // 5 minutes later logout
      logoutTimerRef.current = setTimeout(() => {
        handleLogout()
      }, 5 * 60 * 1000)
    }, 25 * 60 * 1000)
  }

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    const handler = () => resetTimers()
    
    events.forEach(e => window.addEventListener(e, handler))
    resetTimers()
    
    return () => {
      events.forEach(e => window.removeEventListener(e, handler))
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    }
  }, [])

  async function loadNotifications() {
    if (!user) return
    const [{ count }, { data }, { data: accounts }] = await Promise.all([
      supabase.from('notifications').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_read', false),
      supabase.from('notifications').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('accounts').select('id, email, platform, token_timers(next_due_at, group_name, model_name, deleted_at, color)')
        .eq('user_id', user.id).is('deleted_at', null)
    ])
    setUnreadCount(count || 0)
    setNotifications(data || [])

    if (accounts) {
      accountsRef.current = accounts
      let ready = 0
      accounts.forEach(a => {
        const { isReady, hasTimers } = evaluateAccountStatus(a, now)
        if (hasTimers !== false && isReady) {
          ready++
        }
      })
      setReadyCount(ready)
      checkGroupReadyTransitions(accounts, now, addToast)
    }
  }

  // Synchronized 1-second tick driven by TimeContext to update badge and evaluate group-level toasts
  useEffect(() => {
    if (!accountsRef.current || accountsRef.current.length === 0) return
    let ready = 0
    accountsRef.current.forEach(a => {
      const { isReady, hasTimers } = evaluateAccountStatus(a, now)
      if (hasTimers !== false && isReady) ready++
    })
    setReadyCount(ready)
    checkGroupReadyTransitions(accountsRef.current, now, addToast)
  }, [now, addToast])

  // Clear group watcher state when user signs out
  useEffect(() => {
    if (!user) {
      resetGroupReadyWatcher()
    }
  }, [user])

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
    resetGroupReadyWatcher()
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

      {/* ── Sidebar (Desktop Only) ── */}
      <aside
        className={`hidden md:flex ${sidebarW} fixed inset-y-0 left-0 z-20 flex-col py-4 border-r transition-all duration-300 ease-in-out`}
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-4 mb-7 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary text-primary-foreground font-black text-xs">
            AP
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight text-foreground">
              Account<span className="text-primary">Pulse</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 px-2 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map(item => {
            const isAccounts = item.to === '/accounts'
            const showBadge = isAccounts && readyCount > 0
            const badgeText = readyCount > 9 ? '9+' : readyCount
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative group
                  ${collapsed ? 'justify-center' : ''}
                  ${isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="transition-colors">
                      {item.icon}
                    </div>
                    {!collapsed && (
                      <span className="transition-colors">
                        {item.label}
                      </span>
                    )}
                    
                    {/* Badge */}
                    {showBadge && (
                      <span className="absolute top-2 right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-xs">
                        {badgeText}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom Controls */}
        <div className="px-2 mt-4 flex flex-col gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50 ${collapsed ? 'justify-center' : ''}`}
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5 shrink-0" /> : <Moon className="w-4.5 h-4.5 shrink-0" />}
            {!collapsed && <span>Theme</span>}
          </button>

          {/* Divider */}
          <div className="h-px my-1 border-t border-border" />

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50 ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4.5 h-4.5 shrink-0" /> : <ChevronLeft className="w-4.5 h-4.5 shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Right Panel (Top Bar + Content) ── */}
      <div 
        className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out relative pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
        style={{ marginLeft: isMobile ? '0px' : collapsed ? '64px' : '200px' }}
      >

        {/* Top Bar */}
        <header className="h-14 shrink-0 flex items-center gap-4 px-4 md:px-6 border-b bg-card border-border">

          {/* Mobile Brand Logo */}
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shrink-0">
              AP
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              Account<span className="text-primary">Pulse</span>
            </span>
          </div>

          {/* Search (Desktop) */}
          <div className="hidden md:block flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border bg-background border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
            />
          </div>

          {/* Search (Mobile Overlay) */}
          {isMobile && mobileSearchOpen && (
            <div className="absolute inset-y-0 left-0 right-0 z-50 flex items-center px-4 gap-2 bg-card">
              <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm text-foreground"
              />
              <button onClick={() => setMobileSearchOpen(false)} className="p-1.5 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Search Icon (Mobile) */}
            {isMobile && !mobileSearchOpen && (
              <button onClick={() => setMobileSearchOpen(true)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted">
                <Search className="w-4.5 h-4.5" />
              </button>
            )}

            {/* Quick Theme Toggle (Mobile) */}
            {isMobile && (
              <button
                onClick={toggle}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </button>
            )}

            {/* Notifications Bell */}
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted relative"
              title="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Avatar + Dropdown */}
            <div className="relative ml-1" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                title={`Signed in as ${user?.email}`}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold transition-opacity hover:opacity-90 shadow-xs"
              >
                {avatarLetter}
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-lg z-50 overflow-hidden bg-card border-border"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">
                      {user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs mt-0.5 truncate text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>

                  {/* Nav Links */}
                  <div className="py-1">
                    <Link
                      to="/notifications"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-muted text-foreground"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <span>Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-muted text-foreground"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span>Settings</span>
                    </Link>

                    <Link
                      to="/accounts/archived"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-muted text-foreground"
                    >
                      <Archive className="w-4 h-4 text-muted-foreground" />
                      <span>Archived Accounts</span>
                    </Link>
                  </div>

                  {/* Divider + Sign Out */}
                  <div className="border-t border-border py-1">
                    <button
                      onClick={() => { setProfileOpen(false); handleLogout() }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-destructive/10 text-left text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Secondary Navigation Line (Breadcrumbs) */}
        <div className="px-4 md:px-6 py-2.5 border-b flex items-center text-sm shrink-0 bg-background border-border">
          {(() => {
            const pathnames = location.pathname.split('/').filter(x => x)
            const breadcrumbs = [
              { name: 'Dashboard', path: '/dashboard' },
              ...pathnames.map((value, index) => {
                const path = `/${pathnames.slice(0, index + 1).join('/')}`
                const name = value.charAt(0).toUpperCase() + value.slice(1)
                return { name, path }
              })
            ]
            if (location.pathname === '/dashboard') breadcrumbs.pop()

            return breadcrumbs.map((bc, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <div key={bc.path} className="flex items-center">
                  {isLast ? (
                    <span className="font-semibold text-foreground">{bc.name}</span>
                  ) : (
                    <>
                      <Link to={bc.path} className="hover:underline transition-colors text-muted-foreground">{bc.name}</Link>
                      <ChevronRightIcon className="w-3.5 h-3.5 mx-2 text-muted-foreground" />
                    </>
                  )}
                </div>
              )
            })
          })()}
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card border-border flex items-center justify-around px-2 shadow-xs transition-colors"
        style={{
          height: 'calc(3.5rem + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex-1 min-h-[44px] h-11 flex flex-col items-center justify-center gap-0.5 transition-colors touch-manipulation ${
              isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </NavLink>

        {/* Accounts */}
        <NavLink
          to="/accounts"
          className={({ isActive }) =>
            `flex-1 min-h-[44px] h-11 flex flex-col items-center justify-center gap-0.5 transition-colors relative touch-manipulation ${
              isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            {readyCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[8px] font-bold text-white shadow-xs">
                {readyCount > 9 ? '9+' : readyCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Accounts</span>
        </NavLink>

        {/* Subscriptions */}
        <NavLink
          to="/subscriptions"
          className={({ isActive }) =>
            `flex-1 min-h-[44px] h-11 flex flex-col items-center justify-center gap-0.5 transition-colors touch-manipulation ${
              isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px]">Subs</span>
        </NavLink>

        {/* Reports */}
        <NavLink
          to="/reports"
          className={({ isActive }) =>
            `flex-1 min-h-[44px] h-11 flex flex-col items-center justify-center gap-0.5 transition-colors touch-manipulation ${
              isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px]">Reports</span>
        </NavLink>
      </nav>

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

      {/* ── Session Timeout Warning Modal ── */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="border p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center relative z-50 animate-in zoom-in-95 duration-200" 
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'color-mix(in srgb, #ef4444 15%, transparent)', color: '#ef4444' }}>
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--foreground)' }}>Session Expiring Soon</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Your session is about to expire in 5 minutes due to inactivity. Click anywhere or press a key to stay logged in.
            </p>
            <button
              onClick={resetTimers}
              className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-colors hover:bg-primary/90 shadow-xs"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
