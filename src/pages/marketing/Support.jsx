import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

export default function Support() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  const faqs = [
    {
      q: "Why did my token timer reset when I edited my account?",
      a: "Timers only reset when you click the Refresh button or change the interval duration. Editing name, email, or other fields will not affect the timer."
    },
    {
      q: "How do I add multiple models to one account?",
      a: "Open the Edit modal for any account and click 'Add Model'. Each model gets its own independent countdown timer and color."
    },
    {
      q: "What happens when a token expires?",
      a: "The countdown turns red and a notification is logged. Go to the Accounts page and click the refresh button after you have renewed the token."
    },
    {
      q: "Can I recover an archived account?",
      a: "Yes. Go to Accounts > Archived and click Restore on any archived account or subscription."
    },
    {
      q: "Is my data backed up?",
      a: "Yes. All data is stored in Supabase's PostgreSQL database which handles backups automatically."
    }
  ]

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0d1117]">
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Decorative glow blobs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #f59e0b, transparent 70%)' }} />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #ef4444, transparent 70%)' }} />

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
          <Link to="/security" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Security</Link>
          <Link to="/support" className="text-xs font-semibold text-white">Support</Link>
        </div>

        {/* Back to Login Button */}
        <Link to="/login" className="text-xs border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg relative z-10 bg-[#161b22]">
          Back to Login
        </Link>
      </div>

      {/* Main content */}
      <div className={`relative z-10 flex-1 flex flex-col items-center px-6 md:px-12 py-12 md:py-16 max-w-3xl mx-auto w-full transition-all duration-700 ease-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-4xl md:text-5xl font-black text-white text-center leading-tight mb-4">
          Support & <span style={{ color: '#f59e0b' }}>Help</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base text-center max-w-xl mb-12">
          AccountPulse is a personal productivity tool.
        </p>

        {/* FAQ Accordion */}
        <div className="w-full space-y-4 mb-16">
          {faqs.map((faq, i) => (
            <details key={i} className="group bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden transition-colors hover:border-[#f59e0b]/50">
              <summary className="px-6 py-5 cursor-pointer list-none flex items-center justify-between font-bold text-slate-200 text-sm md:text-[15px]">
                {faq.q}
                <ChevronDown className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform duration-300" />
              </summary>
              <div className="px-6 pb-6 pt-0 text-slate-400 text-sm leading-relaxed border-t border-transparent group-open:border-[#30363d] mt-1 transition-all">
                <p className="pt-3">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>

        {/* Contact note */}
        <div className="text-center mt-auto p-6 rounded-2xl border border-dashed border-[#30363d] w-full bg-[#161b22]/50">
          <p className="text-slate-400 text-sm">
            Built and maintained by Ivan. <br className="md:hidden" />
            <span className="text-slate-300">For issues or suggestions, update the app directly.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
