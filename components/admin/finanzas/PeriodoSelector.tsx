'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const PERIODOS = [
  { key: 'mes',       label: 'Este mes'      },
  { key: 'trimestre', label: 'Este trimestre' },
  { key: 'anio',      label: 'Este año'      },
  { key: 'todo',      label: 'Todo'          },
]

export default function PeriodoSelector() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const actual      = searchParams.get('p') ?? 'mes'

  function cambiar(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('p', key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {PERIODOS.map(p => (
        <button
          key={p.key}
          type="button"
          onClick={() => cambiar(p.key)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            actual === p.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
