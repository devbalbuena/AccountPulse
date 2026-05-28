import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Account<span className="text-indigo-500">Pulse</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Token & subscription tracker</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
