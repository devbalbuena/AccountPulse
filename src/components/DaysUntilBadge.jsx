export default function DaysUntilBadge({ days }) {
  if (days === null || days === undefined) return null

  let classes, label

  if (days < 0) {
    classes = 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
    label = 'Overdue'
  } else if (days === 0) {
    classes = 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
    label = 'Due today'
  } else if (days <= 3) {
    classes = 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
    label = `${days}d left`
  } else {
    classes = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/10'
    label = `${days}d left`
  }

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${classes}`}>
      {label}
    </span>
  )
}
