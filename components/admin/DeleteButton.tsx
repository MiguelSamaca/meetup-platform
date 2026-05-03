'use client'

import { useState } from 'react'

interface Props {
  action: () => Promise<void>
  label?: string
  confirm?: string
}

export default function DeleteButton({
  action,
  label = 'Eliminar',
  confirm = '¿Estás seguro? Esta acción no se puede deshacer.',
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!window.confirm(confirm)) return
    setLoading(true)
    await action()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-red-600 hover:text-red-800 disabled:opacity-50 text-sm font-medium transition-colors"
    >
      {loading ? 'Eliminando…' : label}
    </button>
  )
}
