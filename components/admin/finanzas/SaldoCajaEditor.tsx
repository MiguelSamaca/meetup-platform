'use client'

import { useState, useTransition } from 'react'
import { actualizarSaldoCaja }     from '@/app/actions/gastos-fijos'

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SaldoCajaEditor({ saldoActual }: { saldoActual: number }) {
  const [editing, setEditing]   = useState(false)
  const [valor,   setValor]     = useState(String(saldoActual))
  const [pending, startTransition] = useTransition()

  function save() {
    const num = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (isNaN(num) || num < 0) return
    startTransition(async () => {
      await actualizarSaldoCaja(num)
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-500">$</span>
        <input
          type="number"
          value={valor}
          onChange={e => setValor(e.target.value)}
          className="border border-emerald-300 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter')  save()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <button
          onClick={save}
          disabled={pending}
          className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-semibold"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-bold text-emerald-700">${fmt(saldoActual)}</span>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-400 hover:text-emerald-600 transition-colors flex items-center gap-1"
      >
        ✏️ Editar
      </button>
    </div>
  )
}
