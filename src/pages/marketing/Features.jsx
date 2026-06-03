import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Clock, CreditCard, Bell, Archive, Layers, BarChart } from 'lucide-react'

export default function Features() {
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
        style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)' }} />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #2563eb, transparent 70%)' }} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        {/* Logo */}
        <Link to="/login" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #2563eb, #2563eb)' }}>
            <span className="text-white font-extrabold text-xs tracking-tight">AP</span>
          </div>
          <span className="text-white font-bold text-[15px] tracking-tight">AccountPulse</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/features" className="text-xs font-semibold text-white">Features</Link>
          <Link to="/security" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Security</Link>
          <Link to="/support" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Support</Link>
        </div>

        {/* Back to Login Button */}
        <Link to="/login" className="text-xs border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg relative z-10 bg-[#161b22]">
          Back to Login
        </Link>
      </div>

      {/* Main content */}
      <div className={`relative z-10 flex-1 flex flex-col items-center px-6 md:px-12 py-12 md:py-20 max-w-5xl mx-auto w-full transition-all duration-700 ease-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-4xl md:text-5xl font-black text-white text-center leading-tight mb-4">
          Everything You Need to <span style={{ color: '#06b6d4' }}>Stay on Top</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base text-center max-w-2xl mb-16">
          AccountPulse gives you full visibility over your API tokens and subscriptions in one place.
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-20">
          {[
            { 
              icon: <Clock className="w-5 h-5 text-cyan-400" />, 
              title: 'Token Timers', 
              desc: 'Track when your API tokens expire with live countdown clocks. Never get locked out again.' 
            },
            { 
              icon: <CreditCard className="w-5 h-5 text-blue-400" />, 
              title: 'Subscription Tracker', 
              desc: 'Monitor all your paid services with billing dates, amounts, and renewal alerts.' 
            },
            { 
              icon: <Bell className="w-5 h-5 text-amber-400" />, 
              title: 'Smart Alerts', 
              desc: 'Visual warnings when tokens are expiring in under 24 hours with color-coded status badges.' 
            },
            { 
              icon: <Archive className="w-5 h-5 text-emerald-400" />, 
              title: 'Archive System', 
              desc: 'Soft-delete accounts and subscriptions. Restore them any time without losing data.' 
            },
            { 
              icon: <Layers className="w-5 h-5 text-purple-400" />, 
              title: 'Multi-Model Support', 
              desc: 'Assign multiple AI models to one account, each with its own independent timer.' 
            },
            { 
              icon: <BarChart className="w-5 h-5 text-pink-400" />, 
              title: 'Reports & Analytics', 
              desc: 'See your total monthly spend, top expenses, and account activity at a glance.' 
            }
          ].map(feature => (
            <div key={feature.title} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 flex items-start gap-4 hover:border-slate-500 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#21262d] flex items-center justify-center shrink-0 border border-[#30363d]">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-white font-bold mb-1.5">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-slate-300 font-medium mb-4">Ready to get started?</p>
          <Link to="/login" className="inline-block px-8 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-105"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #0891b2)', boxShadow: '0 4px 20px -4px rgba(6,182,212,0.4)' }}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
