'use client'

import { useState } from 'react'

export default function AprobarEtapaButton({ action }: { action: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!window.confirm('¿Confirmar la aprobación de esta etapa?')) return
    setLoading(true)
    try {
      await action()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="mt-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
    >
      {loading ? 'Procesando…' : '✓ Aprobar etapa'}
    </button>
  )
}
