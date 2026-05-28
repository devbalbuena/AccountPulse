import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Sun, Moon, LogOut, User } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z"/>
    </svg>
  )},
  { to: '/accounts', label: 'Accounts', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z"/>
    </svg>
  )},
  { to: '/subscriptions', label: 'Subscriptions', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd"/>
    </svg>
  )},
  { to: '/notifications', label: 'Notifications', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M4 8a6 6 0 1112 0v2.041c0 .329.114.648.32.903l1.41 1.763A.75.75 0 0117.144 14H2.856a.75.75 0 01-.586-1.293l1.41-1.763A1.5 1.5 0 004 10.04V8zm6 10a2 2 0 002-2H8a2 2 0 002 2z" clipRule="evenodd"/>
    </svg>
  )},
]

export default function AppLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    async function loadNotifications() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
    if (user) loadNotifications()
    const interval = setInterval(() => { if (user) loadNotifications() }, 60000)
    return () => clearInterval(interval)
  }, [user])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 min-h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col px-3 py-5">
        {/* Logo */}
        <div className="px-2 mb-7">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Account<span className="text-indigo-500">Pulse</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative
                ${isActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                }`
              }
            >
              {item.icon}
              {item.label}
              {item.label === 'Notifications' && unreadCount > 0 && (
                <span className="ml-auto flex items-center justify-center h-4.5 min-w-[1.125rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto flex flex-col gap-3">
          {unreadCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50">
              <span className="text-red-500 text-xs">●</span>
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {unreadCount} token{unreadCount > 1 ? 's' : ''} expired
              </span>
            </div>
          )}

          <div className="h-px bg-border/60 my-2" />

          <div className="flex items-center justify-between px-2 pb-1">
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{user?.email}</p>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={toggle} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-md hover:bg-muted hover:text-destructive text-muted-foreground transition-colors" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
