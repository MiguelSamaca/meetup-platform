'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  actualizarAnticipo,
  actualizarSaldo,
  actualizarItemEstado,
  actualizarAnticipoProv,
  actualizarItemFechas,
  actualizarProveedorMontos,
  reordenarItems,
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
  fecha_solicitud:          string | null
  fecha_entrega:            string | null
  anticipo_proveedor_pagado: boolean
  orden:                    number
}

interface ProveedorData {
  proveedor:      string
  monto_orden:    number
  anticipo_monto: number
}

interface Props {
  oe:                  OEData
  initialItems:        OEItem[]
  initialProveedores:  ProveedorData[]
}

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function parseFmt(v: string): number {
  return parseFloat(v.replace(/[^\d]/g, '')) || 0
}

const ESTADOS = ['pendiente', 'pedido', 'en_bodega'] as const
type EstadoItem = typeof ESTADOS[number]

const ESTADO_LABEL: Record<EstadoItem, string> = {
  pendiente: 'Pendiente',
  pedido:    'Pedido ✓',
  en_bodega: 'En Bodega ✓',
}
const ESTADO_ACTIVE: Record<EstadoItem, string> = {
  pendiente: 'bg-gray-500 text-white',
  pedido:    'bg-amber-400 text-white',
  en_bodega: 'bg-emerald-500 text-white',
}
const ESTADO_INACTIVE = 'bg-white text-gray-300 hover:bg-gray-50 border-gray-100'

const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400'

/* ── Component ── */
export default function OrdenEjecucionPanel({ oe, initialItems, initialProveedores }: Props) {
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  /* ── Pagos cliente ── */
  const [pct,              setPct]             = useState(String(oe.anticipo_porcentaje))
  const [anticipoFecha,    setAnticipFecha]    = useState(oe.anticipo_fecha ?? '')
  const [anticipoRecibido, setAnticipRecibido] = useState(oe.anticipo_recibido)
  const [saldoFecha,       setSaldoFecha]      = useState(oe.saldo_fecha ?? '')
  const [saldoRecibido,    setSaldoRecibido]   = useState(oe.saldo_recibido)

  const pctNum        = Math.min(100, Math.max(0, parseFloat(pct) || 0))
  const anticipoMonto = Math.round(oe.total_cotizacion * pctNum / 100)
  const saldoMonto    = oe.total_cotizacion - anticipoMonto
  const ivaAnticipo   = Math.round(anticipoMonto * 0.19)
  const ivaSaldo      = Math.round(saldoMonto    * 0.19)

  function saveAnticipoPct() {
    startTransition(() => actualizarAnticipo(oe.id, { anticipo_porcentaje: pctNum, anticipo_monto: anticipoMonto }))
  }
  function toggleAnticipRecibido() {
    const v = !anticipoRecibido; setAnticipRecibido(v)
    startTransition(() => actualizarAnticipo(oe.id, { anticipo_recibido: v }))
  }
  function saveAnticipFecha(v: string) {
    setAnticipFecha(v)
    startTransition(() => actualizarAnticipo(oe.id, { anticipo_fecha: v || null }))
  }
  function toggleSaldoRecibido() {
    const v = !saldoRecibido; setSaldoRecibido(v)
    startTransition(() => actualizarSaldo(oe.id, { saldo_recibido: v }))
  }
  function saveSaldoFecha(v: string) {
    setSaldoFecha(v)
    startTransition(() => actualizarSaldo(oe.id, { saldo_fecha: v || null }))
  }

  /* ── Ítems ── */
  const [items, setItems] = useState<OEItem[]>(initialItems)

  function handleItemEstado(itemId: string, estado: EstadoItem) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, estado } : i))
    startTransition(() => actualizarItemEstado(oe.id, itemId, estado))
  }

  function handleFechaSolicitud(itemId: string, v: string) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, fecha_solicitud: v || null } : i))
    const item = items.find(i => i.id === itemId)
    startTransition(() => actualizarItemFechas(oe.id, itemId, v || null, item?.fecha_entrega ?? null))
  }

  function handleFechaEntrega(itemId: string, v: string) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, fecha_entrega: v || null } : i))
    const item = items.find(i => i.id === itemId)
    startTransition(() => actualizarItemFechas(oe.id, itemId, item?.fecha_solicitud ?? null, v || null))
  }

  function moveItem(itemId: string, dir: 'up' | 'down') {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === itemId)
      if (dir === 'up'   && idx <= 0)               return prev
      if (dir === 'down' && idx >= prev.length - 1) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      startTransition(() => reordenarItems(oe.id, next.map(i => i.id)))
      return next
    })
  }

  /* ── Anticipo proveedor (toggle) ── */
  function handleAnticipoProv(proveedor: string | null, pagado: boolean) {
    setItems(prev => prev.map(i =>
      i.proveedor === proveedor ? { ...i, anticipo_proveedor_pagado: pagado } : i
    ))
    startTransition(() => actualizarAnticipoProv(oe.id, proveedor, pagado))
  }

  /* ── Montos por proveedor ── */
  const [provMap, setProvMap] = useState<Map<string, { monto_orden: string; anticipo_monto: string }>>(() => {
    const m = new Map<string, { monto_orden: string; anticipo_monto: string }>()
    for (const p of initialProveedores) {
      m.set(p.proveedor, {
        monto_orden:    p.monto_orden    > 0 ? String(p.monto_orden)    : '',
        anticipo_monto: p.anticipo_monto > 0 ? String(p.anticipo_monto) : '',
      })
    }
    return m
  })

  function getProvData(proveedor: string) {
    return provMap.get(proveedor) ?? { monto_orden: '', anticipo_monto: '' }
  }
  function setProvField(proveedor: string, field: 'monto_orden' | 'anticipo_monto', raw: string) {
    setProvMap(prev => {
      const cur = prev.get(proveedor) ?? { monto_orden: '', anticipo_monto: '' }
      const next = new Map(prev)
      next.set(proveedor, { ...cur, [field]: raw })
      return next
    })
  }
  function saveProvMontos(proveedor: string) {
    const d = getProvData(proveedor)
    const mo = parseFmt(d.monto_orden)
    const am = parseFmt(d.anticipo_monto)
    startTransition(() => actualizarProveedorMontos(oe.id, proveedor, mo, am))
  }

  /* ── Agrupar ítems por proveedor ── */
  const grupos = useMemo(() => {
    const map = new Map<string, OEItem[]>()
    for (const item of items) {
      const key = item.proveedor ?? '—Sin proveedor—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  const totalItems  = items.length
  const totalBodega = items.filter(i => i.estado === 'en_bodega').length

  /* ── Toggle button ── */
  function ToggleBtn({ ok, onToggle, labels }: { ok: boolean; onToggle: () => void; labels: [string, string] }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          ok
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs flex-shrink-0 ${
          ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
        }`}>
          {ok && '✓'}
        </span>
        {ok ? labels[0] : labels[1]}
      </button>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Sección 1: Pagos del cliente ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <span>💰</span>
          <h2 className="font-semibold text-gray-800">Pagos del cliente</h2>
        </div>
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left pb-3 w-28">Concepto</th>
                <th className="text-left pb-3 w-28">%</th>
                <th className="text-right pb-3 w-52">Monto</th>
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
                      onBlur={saveAnticipoPct}
                      className={`${inputCls} w-24 pr-6 text-right`}
                    />
                    <span className="absolute right-3 text-gray-400 text-xs pointer-events-none">%</span>
                  </div>
                </td>
                <td className="py-3 text-right">
                  <p className="font-bold text-gray-900 text-base">${fmt(anticipoMonto)}</p>
                  <p className="text-xs text-gray-400">IVA: ${fmt(ivaAnticipo)}</p>
                  <p className="text-xs text-emerald-700 font-semibold">Con IVA: ${fmt(anticipoMonto + ivaAnticipo)}</p>
                </td>
                <td className="py-3 pl-6">
                  <input type="date" value={anticipoFecha}
                    onChange={e => saveAnticipFecha(e.target.value)}
                    className={`${inputCls} w-40`} />
                </td>
                <td className="py-3 pl-4">
                  <ToggleBtn ok={anticipoRecibido} onToggle={toggleAnticipRecibido} labels={['Recibido', 'Pendiente']} />
                </td>
              </tr>
              {/* Saldo */}
              <tr>
                <td className="py-3 font-medium text-gray-700">Saldo</td>
                <td className="py-3 text-sm text-gray-400">{100 - pctNum}%</td>
                <td className="py-3 text-right">
                  <p className="font-bold text-gray-900 text-base">${fmt(saldoMonto)}</p>
                  <p className="text-xs text-gray-400">IVA: ${fmt(ivaSaldo)}</p>
                  <p className="text-xs text-emerald-700 font-semibold">Con IVA: ${fmt(saldoMonto + ivaSaldo)}</p>
                </td>
                <td className="py-3 pl-6">
                  <input type="date" value={saldoFecha}
                    onChange={e => saveSaldoFecha(e.target.value)}
                    className={`${inputCls} w-40`} />
                </td>
                <td className="py-3 pl-4">
                  <ToggleBtn ok={saldoRecibido} onToggle={toggleSaldoRecibido} labels={['Recibido', 'Pendiente']} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sección 2: Equipos por proveedor ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>📦</span>
            <h2 className="font-semibold text-gray-800">Pedidos a proveedores</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {totalBodega}/{totalItems} en bodega
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {grupos.map(([provKey, groupItems]) => {
            const esSinProv     = provKey === '—Sin proveedor—'
            const proveedor     = esSinProv ? null : provKey
            const anticipoPagado = groupItems.every(i => i.estado !== 'pendiente' && i.anticipo_proveedor_pagado)
              || groupItems.every(i => i.anticipo_proveedor_pagado)
            const todosEnBodega = groupItems.every(i => i.estado === 'en_bodega')

            // Montos financieros del proveedor
            const provData      = esSinProv ? null : getProvData(provKey)
            const montoOrden    = parseFmt(provData?.monto_orden ?? '')
            const anticipoGirado = parseFmt(provData?.anticipo_monto ?? '')
            const faltaPagar    = Math.max(0, montoOrden - anticipoGirado)
            const pctAnticipo   = montoOrden > 0 ? Math.round((anticipoGirado / montoOrden) * 100) : 0

            return (
              <div key={provKey} className={todosEnBodega ? 'bg-emerald-50/40' : ''}>

                {/* Cabecera del grupo */}
                <div className="px-5 py-4 flex flex-wrap items-start gap-4">
                  {/* Nombre proveedor */}
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <span className={`text-xs font-bold uppercase tracking-widest ${esSinProv ? 'text-gray-400' : 'text-gray-700'}`}>
                      {esSinProv ? 'Sin proveedor' : provKey}
                    </span>
                    <span className="text-xs text-gray-400">{groupItems.length} ítem{groupItems.length !== 1 ? 's' : ''}</span>
                    {todosEnBodega && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ En bodega
                      </span>
                    )}
                  </div>

                  {/* Montos financieros (solo si tiene proveedor) */}
                  {!esSinProv && provData !== null && (
                    <div className="flex flex-wrap items-end gap-3 flex-1">
                      {/* Monto orden de compra */}
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Monto orden compra</p>
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-gray-400 text-xs">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={provData.monto_orden ? Number(parseFmt(provData.monto_orden)).toLocaleString('es-CO') : ''}
                            onChange={e => setProvField(provKey, 'monto_orden', e.target.value.replace(/[^\d]/g, ''))}
                            onBlur={() => saveProvMontos(provKey)}
                            placeholder="0"
                            className="pl-6 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right w-36 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                      </div>

                      {/* Anticipo girado */}
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Anticipo girado</p>
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-gray-400 text-xs">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={provData.anticipo_monto ? Number(parseFmt(provData.anticipo_monto)).toLocaleString('es-CO') : ''}
                            onChange={e => setProvField(provKey, 'anticipo_monto', e.target.value.replace(/[^\d]/g, ''))}
                            onBlur={() => saveProvMontos(provKey)}
                            placeholder="0"
                            className="pl-6 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right w-36 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                      </div>

                      {/* Resumen falta */}
                      {montoOrden > 0 && (
                        <div className="pb-1">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Falta por girar</p>
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-gray-800 text-sm">${fmt(faltaPagar)}</span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                              pctAnticipo >= 100
                                ? 'bg-emerald-100 text-emerald-700'
                                : pctAnticipo >= 50
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {pctAnticipo}% girado
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Toggle anticipo pagado */}
                      <div className="pb-1">
                        <button
                          type="button"
                          onClick={() => handleAnticipoProv(proveedor, !anticipoPagado)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                            anticipoPagado
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center text-[9px] flex-shrink-0 ${
                            anticipoPagado ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                          }`}>
                            {anticipoPagado && '✓'}
                          </span>
                          Anticipo confirmado
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ítems del grupo */}
                <div className="border-t border-gray-100">
                  {groupItems.map((item, idxInGroup) => {
                    const globalIdx = items.findIndex(i => i.id === item.id)
                    return (
                      <div
                        key={item.id}
                        className={`px-5 py-3 border-b border-gray-50 last:border-0 ${
                          item.estado === 'en_bodega' ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          {/* ▲▼ Reorder */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button type="button"
                              onClick={() => moveItem(item.id, 'up')}
                              disabled={globalIdx === 0}
                              className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-[10px] leading-none px-0.5"
                              title="Subir">▲</button>
                            <button type="button"
                              onClick={() => moveItem(item.id, 'down')}
                              disabled={globalIdx === items.length - 1}
                              className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-[10px] leading-none px-0.5"
                              title="Bajar">▼</button>
                          </div>

                          {/* Descripción */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-xs font-semibold shrink-0">×{item.cantidad}</span>
                              <p className="text-sm font-medium text-gray-800 truncate">{item.descripcion}</p>
                              {item.referencia && (
                                <span className="text-xs font-mono text-gray-400 shrink-0">{item.referencia}</span>
                              )}
                            </div>
                          </div>

                          {/* Estado */}
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs shrink-0">
                            {ESTADOS.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleItemEstado(item.id, s)}
                                className={`px-3 py-1.5 font-medium transition-colors ${
                                  item.estado === s ? ESTADO_ACTIVE[s] : ESTADO_INACTIVE
                                }`}
                              >
                                {ESTADO_LABEL[s]}
                              </button>
                            ))}
                          </div>

                          {/* Fecha solicitud */}
                          <div className="shrink-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Solicitud</p>
                            <input
                              type="date"
                              value={item.fecha_solicitud ?? ''}
                              onChange={e => handleFechaSolicitud(item.id, e.target.value)}
                              className="px-2 py-1 border border-dashed border-gray-300 rounded text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-solid w-34"
                            />
                          </div>

                          {/* Fecha entrega */}
                          <div className="shrink-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Entrega en bodega</p>
                            <input
                              type="date"
                              value={item.fecha_entrega ?? ''}
                              onChange={e => handleFechaEntrega(item.id, e.target.value)}
                              className="px-2 py-1 border border-dashed border-gray-300 rounded text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-solid w-34"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
