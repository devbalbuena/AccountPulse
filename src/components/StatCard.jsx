export default function StatCard({ title, value, subtitle, icon, pulse = false }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-border/50 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-none flex items-center gap-2">
            {pulse && (
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {value}
          </p>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{subtitle}</p>}
        </div>
        <div className="mt-0.5">{icon}</div>
      </div>
    </div>
  )
}
