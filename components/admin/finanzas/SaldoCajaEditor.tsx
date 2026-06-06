'use client'

import { useState, useTransition } from 'react'
import { actualizarSaldoCaja }     from '@/app/actions/gastos-fijos'

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

interface DetalleCaja {
  entradas:      number   // anticipos + saldos recibidos de clientes
  salidasProv:   number   // anticipos pagados a proveedores
  salidasGastos: number   // gastos ya realizados
}

export default function SaldoCajaEditor({
  saldoActual,
  saldoCalculado,
  detalleCaja,
}: {
  saldoActual:     number
  saldoCalculado?: number
  detalleCaja?:    DetalleCaja
}) {
  const [editing, setEditing]      = useState(false)
  const [valor,   setValor]        = useState(String(saldoActual))
  const [pending, startTransition] = useTransition()

  function save(monto: number) {
    startTransition(async () => {
      await actualizarSaldoCaja(monto)
      setValor(String(monto))
      setEditing(false)
    })
  }

  function usarCalculado() {
    if (saldoCalculado === undefined) return
    save(saldoCalculado)
  }

  /* ── Caso con cálculo automático ── */
  if (saldoCalculado !== undefined) {
    return (
      <div className="space-y-3">

        {/* Caja calculada del sistema */}
        <div>
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
            🔢 Calculado de transacciones
          </p>
          <p className="text-2xl font-bold text-emerald-700">${fmt(saldoCalculado)}</p>
          {detalleCaja && (
            <div className="text-xs text-emerald-600 mt-1 space-y-0.5">
              <span className="inline-flex gap-1">
                <span className="text-emerald-500">↑</span> Cobros recibidos: <strong>${fmt(detalleCaja.entradas)}</strong>
              </span>
              {' · '}
              <span className="inline-flex gap-1">
                <span className="text-red-400">↓</span> Pagos prov.: <strong>−${fmt(detalleCaja.salidasProv)}</strong>
              </span>
              {detalleCaja.salidasGastos > 0 && (
                <>
                  {' · '}
                  <span className="inline-flex gap-1">
                    <span className="text-red-400">↓</span> Gastos: <strong>−${fmt(detalleCaja.salidasGastos)}</strong>
                  </span>
                </>
              )}
            </div>
          )}
          {saldoCalculado !== saldoActual && (
            <button
              onClick={usarCalculado}
              disabled={pending}
              className="mt-2 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-50"
            >
              {pending ? '…' : '⟳ Guardar como saldo actual'}
            </button>
          )}
        </div>

        {/* Ajuste manual */}
        <div className="border-t border-emerald-200 pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Ajuste manual registrado
          </p>
          {editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-500">$</span>
              <input
                type="number"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="border border-emerald-300 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter')  save(Number(valor))
                  if (e.key === 'Escape') setEditing(false)
                }}
              />
              <button
                onClick={() => save(Number(valor))}
                disabled={pending}
                className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-semibold"
              >
                {pending ? '…' : 'Guardar'}
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-700">${fmt(saldoActual)}</span>
              <button
                onClick={() => { setValor(String(saldoActual)); setEditing(true) }}
                className="text-xs text-gray-400 hover:text-emerald-600 transition-colors"
              >
                ✏️ Editar
              </button>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Usa esto si el sistema no refleja un pago en banco, efectivo u otro medio externo.
          </p>
        </div>
      </div>
    )
  }

  /* ── Caso simple (sin cálculo — usado en dashboard) ── */
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
            if (e.key === 'Enter')  save(Number(valor))
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <button
          onClick={() => save(Number(valor))}
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
