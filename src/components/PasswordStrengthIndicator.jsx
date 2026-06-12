import { useMemo } from 'react'

export default function PasswordStrengthIndicator({ password }) {
  const strength = useMemo(() => {
    let score = 0
    if (!password) return { score: 0, label: 'None', color: 'bg-slate-200 dark:bg-slate-800' }
    
    if (password.length >= 8) score += 1
    if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) score += 1
    if (password.length >= 8 && /[^a-zA-Z0-9]/.test(password)) score += 1
    if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1

    switch (score) {
      case 0:
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-red-500', width: '25%' }
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500', width: '50%' }
      case 3:
        return { score: 3, label: 'Good', color: 'bg-blue-500', width: '75%' }
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-green-500', width: '100%' }
      default:
        return { score: 0, label: 'None', color: 'bg-slate-200 dark:bg-slate-800', width: '0%' }
    }
  }, [password])

  if (!password) return null

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Password Strength</span>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${strength.color.replace('bg-', 'text-')}`}>
          {strength.label}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${strength.color} transition-all duration-300`} 
          style={{ width: strength.width }} 
        />
      </div>
    </div>
  )
}
