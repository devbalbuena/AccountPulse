import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

// Input styling: dark-on-dark vs white background in light mode
const inputCls = [
  "w-full px-4 py-3 rounded-lg text-sm transition-all duration-200 outline-none",
  "bg-[#f5f5ff] border border-[#e2e4f0] text-slate-900 placeholder:text-slate-400",
  "dark:bg-[#1a1d27] dark:border-[#2e3248] dark:text-white dark:placeholder:text-slate-500",
  "focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
].join(' ')

const labelCls = "block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2"

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) { setError(error.message) } else { navigate('/dashboard') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* ── LEFT PANEL: Branding ── */}
      <div
        className="hidden md:flex md:w-[55%] flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0d1117 60%, #1a1f35 100%)' }}
      >
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Decorative glow blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)' }} />
        <div className="absolute bottom-[-100px] right-[-60px] w-[350px] h-[350px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)' }} />

        {/* Top nav row */}
        <div className="relative z-10 flex items-center justify-between px-10 pt-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
              <span className="text-white font-extrabold text-xs tracking-tight">AP</span>
            </div>
            <span className="text-white font-bold text-[15px] tracking-tight">AccountPulse</span>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-5">
            <Link to="/features" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Features</Link>
            <Link to="/security" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Security</Link>
            <Link to="/support" className="text-xs border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-md">
              Support
            </Link>
          </div>
        </div>

        {/* Main content */}
        <div className={`relative z-10 flex-1 flex flex-col justify-center px-12 xl:px-16 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Version badge */}
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Account Pulse v1.0
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] mb-5">
            Maximize Your{' '}
            <span style={{ color: '#06b6d4' }}>Subscription Value</span>
            {' '}& Track Every Token
          </h2>

          {/* Description */}
          <p className="text-slate-400 text-sm leading-relaxed max-w-md mb-10">
            Harness the power of real-time tracking and insightful analytics. Experience a high-energy
            dashboard designed for precision, security, and momentum in your token journey.
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-8">
            {[
              { value: 'Real-time', label: 'TOKEN TIMERS' },
              { value: 'Auto-detect', label: 'BILLING CYCLES' },
              { value: 'Encrypted', label: 'DATA SECURITY' },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-white font-extrabold text-lg leading-tight">{stat.value}</p>
                <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="relative z-10 px-12 pb-8">
          <p className="text-slate-600 text-[11px]">AccountPulse © 2025. All rights reserved.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL: Form ── */}
      <div className="flex-1 md:w-[45%] flex items-center justify-center px-6 py-12
        bg-white dark:bg-[#0f1117] transition-colors duration-300">
        <div className={`w-full max-w-[380px] transition-all duration-700 delay-150 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
              <span className="text-white font-extrabold text-[11px]">AP</span>
            </div>
            <span className="font-bold text-[14px] text-slate-900 dark:text-white">AccountPulse</span>
          </div>

          {/* Title */}
          <div className="mb-7">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1.5">Welcome Back</h1>
            <p className="text-sm text-slate-400">Access your pulse dashboard.</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelCls}>Email Address</label>
              <input
                type="email" required className={inputCls}
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls} style={{ marginBottom: 0 }}>Password</label>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-500 hover:text-cyan-400 cursor-pointer transition-colors">
                  Forgot?
                </span>
              </div>
              <input
                type="password" required className={inputCls}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ background: 'linear-gradient(90deg, #06b6d4, #0891b2)', boxShadow: '0 4px 20px -4px rgba(6,182,212,0.4)' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 24px -4px rgba(6,182,212,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px -4px rgba(6,182,212,0.4)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center mt-7 text-sm text-slate-400">
            New to AccountPulse?{' '}
            <Link to="/register"
              className="font-semibold text-cyan-500 hover:text-cyan-400 transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
