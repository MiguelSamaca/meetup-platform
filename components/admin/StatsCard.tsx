interface StatsCardProps {
  label: string
  value: number | string
  sub?: string
  color?: 'emerald' | 'blue' | 'amber' | 'red'
}

const colorMap = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  red:     'bg-red-50 text-red-700 border-red-200',
}

export default function StatsCard({ label, value, sub, color = 'emerald' }: StatsCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}
