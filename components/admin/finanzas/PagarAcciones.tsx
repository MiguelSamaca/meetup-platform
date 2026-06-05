'use client'

import { useState, useTransition } from 'react'
import { actualizarAnticipoProv } from '@/app/actions/ordenes'

interface Props {
  oeId:             string
  proveedor:        string
  anticipoPagado:   boolean
  anticipoMonto:    number
  saldoMonto:       number
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function PagarAcciones({
  oeId, proveedor, anticipoPagado, anticipoMonto, saldoMonto,
}: Props) {
  const [pagado, setPagado] = useState(anticipoPagado)
  const [pending, start]    = useTransition()

  function toggle() {
    const next = !pagado
    setPagado(next)
    start(() => actualizarAnticipoProv(oeId, proveedor, next))
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      title={pagado
        ? `Anticipo girado: $${fmt(anticipoMonto)}`
        : `Confirmar anticipo: $${fmt(anticipoMonto)}`}
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
        pagado
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {pagado ? '✓ Anticipo girado' : '○ Confirmar anticipo'}
    </button>
  )
}
