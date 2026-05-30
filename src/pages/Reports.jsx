import { BarChart2 } from 'lucide-react'

export default function Reports() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'color-mix(in srgb, var(--ap-accent) 12%, transparent)' }}>
        <BarChart2 className="w-8 h-8" style={{ color: 'var(--ap-accent)' }} />
      </div>
      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Reports</h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
        Analytics and reporting features are coming soon. Check back later!
      </p>
    </div>
  )
}
