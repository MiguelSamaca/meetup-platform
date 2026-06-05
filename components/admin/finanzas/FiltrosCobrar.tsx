'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const ESTADOS = [
  { key: '',          label: 'Todos'            },
  { key: 'pendiente', label: 'Pendiente'        },
  { key: 'anticipo',  label: 'Anticipo ✓'       },
  { key: 'pagado',    label: 'Pagado'           },
  { key: 'vencido',   label: '⚠ Vencido'       },
]

export default function FiltrosCobrar() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const estado      = searchParams.get('estado') ?? ''

  function setEstado(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key) params.set('estado', key)
    else     params.delete('estado')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {ESTADOS.map(e => (
        <button
          key={e.key}
          type="button"
          onClick={() => setEstado(e.key)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            estado === e.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {e.label}
        </button>
      ))}
    </div>
  )
}
