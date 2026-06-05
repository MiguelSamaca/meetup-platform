'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function VistaPagarSelector() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const vista       = searchParams.get('vista') ?? 'proveedor'

  function cambiar(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('vista', v)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {[
        { key: 'proveedor', label: '🏭 Por proveedor' },
        { key: 'oe',        label: '📦 Por OE'        },
      ].map(v => (
        <button
          key={v.key}
          type="button"
          onClick={() => cambiar(v.key)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            vista === v.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
