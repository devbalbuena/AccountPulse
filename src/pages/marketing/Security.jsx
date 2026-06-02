import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Key, EyeOff, Lock } from 'lucide-react'

export default function Security() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0d1117]">
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Decorative glow blobs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }} />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        {/* Logo */}
        <Link to="/login" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
            <span className="text-white font-extrabold text-xs tracking-tight">AP</span>
          </div>
          <span className="text-white font-bold text-[15px] tracking-tight">AccountPulse</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/features" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Features</Link>
          <Link to="/security" className="text-xs font-semibold text-white">Security</Link>
          <Link to="/support" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Support</Link>
        </div>

        {/* Back to Login Button */}
        <Link to="/login" className="text-xs border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg relative z-10 bg-[#161b22]">
          Back to Login
        </Link>
      </div>

      {/* Main content */}
      <div className={`relative z-10 flex-1 flex flex-col items-center px-6 md:px-12 py-12 md:py-20 max-w-4xl mx-auto w-full transition-all duration-700 ease-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-4xl md:text-5xl font-black text-white text-center leading-tight mb-4">
          Your Data, <span style={{ color: '#10b981' }}>Your Control</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base text-center max-w-2xl mb-16">
          AccountPulse is built on Supabase with enterprise-grade security baked in from day one.
        </p>

        {/* Security Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-16">
          {[
            { 
              icon: <Shield className="w-6 h-6 text-emerald-400" />, 
              title: 'Row Level Security', 
              desc: 'Every database query is protected by Supabase RLS policies. Your data is invisible to all other users.' 
            },
            { 
              icon: <Key className="w-6 h-6 text-blue-400" />, 
              title: 'Supabase Auth', 
              desc: 'Authentication is handled entirely by Supabase. Passwords are hashed and never stored in plain text.' 
            },
            { 
              icon: <EyeOff className="w-6 h-6 text-indigo-400" />, 
              title: 'No Third-Party Sharing', 
              desc: 'Your account data, subscription info, and tokens are never shared with or sold to third parties.' 
            },
            { 
              icon: <Lock className="w-6 h-6 text-amber-400" />, 
              title: 'HTTPS Encrypted', 
              desc: 'All data in transit is encrypted via HTTPS/TLS. Data at rest is encrypted by Supabase infrastructure.' 
            }
          ].map(feature => (
            <div key={feature.title} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-4 hover:border-[#10b981]/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#21262d] flex items-center justify-center border border-[#30363d]">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-8 border-t border-[#30363d] w-full max-w-2xl">
          <span className="px-3 py-1.5 rounded-md bg-[#21262d] border border-[#30363d] text-slate-300 text-xs font-medium">Powered by Supabase</span>
          <span className="px-3 py-1.5 rounded-md bg-[#21262d] border border-[#30363d] text-slate-300 text-xs font-medium">React + Vite</span>
          <span className="px-3 py-1.5 rounded-md bg-[#21262d] border border-[#30363d] text-slate-300 text-xs font-medium">Vercel</span>
        </div>
      </div>
    </div>
  )
}
