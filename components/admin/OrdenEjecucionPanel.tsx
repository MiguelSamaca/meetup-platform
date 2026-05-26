'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  actualizarAnticipo,
  actualizarSaldo,
  actualizarItemEstado,
  actualizarAnticipoProv,
  actualizarItemEta,
  completarOrden,
  reabrirOrden,
} from '@/app/actions/ordenes'

/* ── Types ── */
interface OEData {
  id:                  string
  estado:              string
  total_cotizacion:    number
  anticipo_porcentaje: number
  anticipo_monto:      number
  anticipo_fecha:      string | null
  anticipo_recibido:   boolean
  saldo_fecha:         string | null
  saldo_recibido:      boolean
}

interface OEItem {
  id:                       string
  proveedor:                string | null
  referencia:               string | null
  descripcion:              string
  cantidad:                 number
  estado:                   string
  eta:                      string | null
  anticipo_proveedor_pagado: boolean
  orden:                    number
}

interface Props {
  oe:           OEData
  initialItems: OEItem[]
}

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const ESTADOS = ['pendiente', 'pedido', 'recibido'] as const
type EstadoItem = typeof ESTADOS[number]

const estadoBtnStyle: Record<EstadoItem, string> = {
  pendiente: 'bg-gray-500 text-white',
  pedido:    'bg-amber-400 text-white',
  recibido:  'bg-emerald-500 text-white',
}
const estadoInactivo = 'bg-white text-gray-300 hover:bg-gray-50'

const estadoLabel: Record<EstadoItem, string> = {
  pendiente: 'Pendiente',
  pedido:    'Pedido ✓',
  recibido:  'Recibido ✓',
}

/* ── Component ── */
export default function OrdenEjecucionPanel({ oe, initialItems }: Props) {
  const [pending, startTransition] = useTransition()

  // ── Pagos cliente ──
  const [pct,              setPct]              = useState(String(oe.anticipo_porcentaje))
  const [anticipoFecha,    setAnticipFecha]     = useState(oe.anticipo_fecha ?? '')
  const [anticipoRecibido, setAnticipRecibido]  = useState(oe.anticipo_recibido)
  const [saldoFecha,       setSaldoFecha]       = useState(oe.saldo_fecha ?? '')
  const [saldoRecibido,    setSaldoRecibido]    = useState(oe.saldo_recibido)

  // ── Items ──
  const [items, setItems] = useState<OEItem[]>(initialItems)

  // ── Estado OE ──
  const [estadoOE, setEstadoOE] = useState(oe.estado)
  const [confirmando, setConfirmando] = useState(false)

  /* Cálculos derivados */
  const pctNum        = Math.min(100, Math.max(0, parseFloat(pct) || 0))
  const anticipoMonto = Math.round(oe.total_cotizacion * pctNum / 100)
  const saldoMonto    = oe.total_cotizacion - anticipoMonto

  /* Guardar anticipo % + monto en blur */
  function saveAnticipo() {
    startTransition(() =>
      actualizarAnticipo(oe.id, {
        anticipo_porcentaje: pctNum,
        anticipo_monto:      anticipoMonto,
      })
    )
  }

  /* Toggle anticipo recibido */
  function toggleAnticipRecibido() {
    const nuevo = !anticipoRecibido
    setAnticipRecibido(nuevo)
    startTransition(() => actualizarAnticipo(oe.id, { anticipo_recibido: nuevo }))
  }

  /* Fecha anticipo */
  function saveAnticipFecha(v: string) {
    setAnticipFecha(v)
    startTransition(() => actualizarAnticipo(oe.id, { anticipo_fecha: v || null }))
  }

  /* Toggle saldo recibido */
  function toggleSaldoRecibido() {
    const nuevo = !saldoRecibido
    setSaldoRecibido(nuevo)
    startTransition(() => actualizarSaldo(oe.id, { saldo_recibido: nuevo }))
  }

  /* Fecha saldo */
  function saveSaldoFecha(v: string) {
    setSaldoFecha(v)
    startTransition(() => actualizarSaldo(oe.id, { saldo_fecha: v || null }))
  }

  /* Cambiar estado de un ítem */
  function handleItemEstado(itemId: string, estado: EstadoItem) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, estado } : i))
    startTransition(() => actualizarItemEstado(oe.id, itemId, estado))
  }

  /* Cambiar ETA de un ítem */
  function handleItemEta(itemId: string, eta: string) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, eta: eta || null } : i))
    startTransition(() => actualizarItemEta(oe.id, itemId, eta || null))
  }

  /* Toggle anticipo proveedor (por grupo) */
  function handleAnticipoProv(proveedor: string | null, pagado: boolean) {
    setItems(prev => prev.map(i =>
      i.proveedor === proveedor ? { ...i, anticipo_proveedor_pagado: pagado } : i
    ))
    startTransition(() => actualizarAnticipoProv(oe.id, proveedor, pagado))
  }

  /* Completar orden */
  function handleCompletar() {
    setEstadoOE('completada')
    setConfirmando(false)
    startTransition(() => completarOrden(oe.id))
  }

  /* Reabrir */
  function handleReabrir() {
    setEstadoOE('activa')
    startTransition(() => reabrirOrden(oe.id))
  }

  /* Agrupar ítems por proveedor */
  const grupos = useMemo(() => {
    const map = new Map<string, OEItem[]>()
    for (const item of items) {
      const key = item.proveedor ?? '—Sin proveedor—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  const totalItems   = items.length
  const totalRecibid = items.filter(i => i.estado === 'recibido').length

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400'

  return (
    <div className="space-y-6">

      {/* ─── Sección 1: Pagos del cliente ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <span className="text-base">💰</span>
          <h2 className="font-semibold text-gray-800">Pagos del cliente</h2>
        </div>
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left pb-3 w-28">Concepto</th>
                <th className="text-left pb-3 w-28">Porcentaje</th>
                <th className="text-right pb-3 w-40">Monto</th>
                <th className="text-left pb-3 pl-6 w-44">Fecha esperada</th>
                <th className="text-left pb-3 pl-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Anticipo */}
              <tr>
                <td className="py-3 font-medium text-gray-700">Anticipo</td>
                <td className="py-3">
                  <div className="relative w-24 flex items-center">
                    <input
                      type="number" min="0" max="100" step="1"
                      value={pct}
                      onChange={e => setPct(e.target.value)}
                      onBlur={saveAnticipo}
                      className={`${inputCls} w-24 pr-6 text-right`}
                    />
                    <span className="absolute right-3 text-gray-400 text-xs pointer-events-none">%</span>
                  </div>
                </td>
                <td className="py-3 text-right">
                  <span className="font-bold text-gray-900 text-base">${fmt(anticipoMonto)}</span>
                </td>
                <td className="py-3 pl-6">
                  <input
                    type="date"
                    value={anticipoFecha}
                    onChange={e => saveAnticipFecha(e.target.value)}
                    className={`${inputCls} w-40`}
                  />
                </td>
                <td className="py-3 pl-4">
                  <button
                    type="button"
                    onClick={toggleAnticipRecibido}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      anticipoRecibido
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs ${
                      anticipoRecibido ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                    }`}>
                      {anticipoRecibido && '✓'}
                    </span>
                    {anticipoRecibido ? 'Recibido' : 'Pendiente'}
                  </button>
                </td>
              </tr>
              {/* Saldo */}
              <tr>
                <td className="py-3 font-medium text-gray-700">Saldo</td>
                <td className="py-3">
                  <span className="text-sm text-gray-400">{100 - pctNum}%</span>
                </td>
                <td className="py-3 text-right">
                  <span className="font-bold text-gray-900 text-base">${fmt(saldoMonto)}</span>
                </td>
                <td className="py-3 pl-6">
                  <input
                    type="date"
                    value={saldoFecha}
                    onChange={e => saveSaldoFecha(e.target.value)}
                    className={`${inputCls} w-40`}
                  />
                </td>
                <td className="py-3 pl-4">
                  <button
                    type="button"
                    onClick={toggleSaldoRecibido}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      saldoRecibido
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs ${
                      saldoRecibido ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                    }`}>
                      {saldoRecibido && '✓'}
                    </span>
                    {saldoRecibido ? 'Recibido' : 'Pendiente'}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Sección 2: Equipos por proveedor ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <h2 className="font-semibold text-gray-800">Equipos por proveedor</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {totalRecibid}/{totalItems} recibidos
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {grupos.map(([proveedorKey, groupItems]) => {
            const esSinProv  = proveedorKey === '—Sin proveedor—'
            const proveedor  = esSinProv ? null : proveedorKey
            const anticipoPagado = groupItems.every(i => i.anticipo_proveedor_pagado)
            const todosRecib = groupItems.every(i => i.estado === 'recibido')

            return (
              <div key={proveedorKey} className={`${todosRecib ? 'bg-emerald-50/40' : ''}`}>
                {/* Cabecera del grupo */}
                <div className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold uppercase tracking-widest ${
                      esSinProv ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {esSinProv ? 'Sin proveedor' : proveedorKey}
                    </span>
                    <span className="text-xs text-gray-400">
                      {groupItems.length} {groupItems.length === 1 ? 'ítem' : 'ítems'}
                    </span>
                    {todosRecib && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ Todos recibidos
                      </span>
                    )}
                  </div>

                  {/* Anticipo proveedor (solo si tiene proveedor definido) */}
                  {!esSinProv && (
                    <button
                      type="button"
                      onClick={() => handleAnticipoProv(proveedor, !anticipoPagado)}
                      className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        anticipoPagado
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center text-[9px] ${
                        anticipoPagado ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                      }`}>
                        {anticipoPagado && '✓'}
                      </span>
                      Anticipo al proveedor pagado
                    </button>
                  )}
                </div>

                {/* Ítems del grupo */}
                <div className="border-t border-gray-100">
                  {groupItems.map(item => (
                    <div key={item.id}
                      className={`px-5 py-3 flex items-center gap-4 border-b border-gray-50 last:border-0 ${
                        item.estado === 'recibido' ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Referencia + descripción */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-400 text-xs">×{item.cantidad}</span>
                          <p className="text-sm font-medium text-gray-800 truncate">{item.descripcion}</p>
                          {item.referencia && (
                            <span className="text-xs font-mono text-gray-400">{item.referencia}</span>
                          )}
                        </div>
                      </div>

                      {/* Segmented estado */}
                      <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs shrink-0">
                        {ESTADOS.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleItemEstado(item.id, s)}
                            className={`px-3 py-1.5 font-medium transition-colors ${
                              item.estado === s ? estadoBtnStyle[s] : estadoInactivo
                            }`}
                          >
                            {estadoLabel[s]}
                          </button>
                        ))}
                      </div>

                      {/* ETA */}
                      <div className="shrink-0">
                        <input
                          type="date"
                          value={item.eta ?? ''}
                          onChange={e => handleItemEta(item.id, e.target.value)}
                          title="Fecha estimada de entrega"
                          className="px-2 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-solid w-36"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Sección 3: Cierre ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <span className="text-base">✅</span>
          <h2 className="font-semibold text-gray-800">Cierre del proyecto</h2>
        </div>
        <div className="px-5 py-5 flex items-center gap-4">
          {estadoOE === 'activa' ? (
            confirmando ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600">¿Confirmar que todos los equipos fueron entregados?</p>
                <button
                  type="button"
                  onClick={handleCompletar}
                  disabled={pending}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  Sí, marcar como completada
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                <span>✅</span> Marcar proyecto como completado y entregado
              </button>
            )
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 text-lg">✅</span>
                <p className="font-semibold text-emerald-700">Proyecto completado y entregado</p>
              </div>
              <button
                type="button"
                onClick={handleReabrir}
                disabled={pending}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Reabrir
              </button>
            </div>
          )}

          {pending && (
            <span className="text-xs text-gray-400 animate-pulse ml-2">Guardando…</span>
          )}
        </div>
      </div>

    </div>
  )
}
