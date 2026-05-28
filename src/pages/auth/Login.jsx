import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
const labelCls = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) { setError(error.message) } else { navigate('/dashboard') }
    setLoading(false)
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm dark:shadow-none">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Sign in</h2>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" required className={inputCls} placeholder="you@example.com"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Password</label>
          <input type="password" required className={inputCls} placeholder="••••••••"
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center mt-5 text-sm text-slate-500 dark:text-slate-400">
        No account?{' '}
        <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Create one</Link>
      </p>
    </div>
  )
}
