'use client'

import { useState, useTransition } from 'react'
import { actualizarAnticipo, actualizarSaldo } from '@/app/actions/ordenes'

interface Props {
  oeId:             string
  anticipoRecibido: boolean
  saldoRecibido:    boolean
  anticipoMonto:    number
  saldoMonto:       number
}

export default function CobrarAcciones({
  oeId, anticipoRecibido, saldoRecibido, anticipoMonto, saldoMonto,
}: Props) {
  const [antRec, setAntRec] = useState(anticipoRecibido)
  const [salRec, setSalRec] = useState(saldoRecibido)
  const [pending, start]    = useTransition()

  function fmt(n: number) {
    return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  function toggleAnticipo() {
    const next = !antRec
    setAntRec(next)
    start(() => actualizarAnticipo(oeId, { anticipo_recibido: next }))
  }

  function toggleSaldo() {
    const next = !salRec
    setSalRec(next)
    start(() => actualizarSaldo(oeId, { saldo_recibido: next }))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Anticipo */}
      <button
        type="button"
        disabled={pending}
        onClick={toggleAnticipo}
        title={antRec ? `Anticipo recibido: $${fmt(anticipoMonto)}` : `Marcar anticipo como recibido: $${fmt(anticipoMonto)}`}
        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
          antRec
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600'
        }`}
      >
        {antRec ? '✓' : '○'} Anticipo
      </button>

      {/* Saldo */}
      <button
        type="button"
        disabled={pending || !antRec}
        onClick={toggleSaldo}
        title={
          !antRec
            ? 'Primero confirma el anticipo'
            : salRec
            ? `Saldo recibido: $${fmt(saldoMonto)}`
            : `Marcar saldo como recibido: $${fmt(saldoMonto)}`
        }
        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
          salRec
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            : !antRec
            ? 'opacity-30 cursor-not-allowed bg-white border-gray-200 text-gray-400'
            : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600'
        }`}
      >
        {salRec ? '✓' : '○'} Saldo
      </button>
    </div>
  )
}
