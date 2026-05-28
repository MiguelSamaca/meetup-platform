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
  precio_unitario:          number
  descuento:                number
  costo_unitario:           number
  moneda_costo:             string
  trm:                      number | null
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

  /* ── Anticipo proveedor (toggle) ── */
  function handleAnticipoProv(proveedor: string | null, pagado: boolean) {
    setItems(prev => prev.map(i =>
      i.proveedor === proveedor ? { ...i, anticipo_proveedor_pagado: pagado } : i
    ))
    startTransition(() => actualizarAnticipoProv(oe.id, proveedor, pagado))
  }

  /* ── Montos + anticipo % por proveedor ── */
  interface ProvState {
    monto_orden:    string
    anticipo_monto: string
    anticipo_pct:   string
  }

  const [provMap, setProvMap] = useState<Map<string, ProvState>>(() => {
    // Pre-calcular costo total por proveedor desde los ítems
    const itemCostMap = new Map<string, number>()
    for (const item of initialItems) {
      if (!item.proveedor) continue
      const cop  = item.moneda_costo === 'USD' ? item.costo_unitario * (item.trm ?? 1) : item.costo_unitario
      const cost = item.cantidad * cop
      itemCostMap.set(item.proveedor, (itemCostMap.get(item.proveedor) ?? 0) + cost)
    }

    const m = new Map<string, ProvState>()
    for (const p of initialProveedores) {
      const calcCost = Math.round(itemCostMap.get(p.proveedor) ?? 0)
      // Usar el costo guardado, o si es 0 usar el calculado de los ítems
      const mo = p.monto_orden    > 0 ? String(p.monto_orden)    : calcCost > 0 ? String(calcCost) : ''
      const am = p.anticipo_monto > 0 ? String(p.anticipo_monto) : ''
      const moNum = parseFloat(mo) || 0
      const ap = moNum > 0 && p.anticipo_monto > 0
        ? String(Math.round((p.anticipo_monto / moNum) * 100))
        : ''
      m.set(p.proveedor, { monto_orden: mo, anticipo_monto: am, anticipo_pct: ap })
    }

    // Agregar proveedores que tienen ítems pero no registro en oe_proveedores aún
    for (const [prov, cost] of itemCostMap) {
      if (!m.has(prov) && cost > 0) {
        m.set(prov, { monto_orden: String(Math.round(cost)), anticipo_monto: '', anticipo_pct: '' })
      }
    }

    return m
  })

  function getProvData(proveedor: string): ProvState {
    return provMap.get(proveedor) ?? { monto_orden: '', anticipo_monto: '', anticipo_pct: '' }
  }

  function setProvField(
    proveedor: string,
    field: 'monto_orden' | 'anticipo_monto' | 'anticipo_pct',
    raw: string,
  ) {
    setProvMap(prev => {
      const cur  = prev.get(proveedor) ?? { monto_orden: '', anticipo_monto: '', anticipo_pct: '' }
      const next = new Map(prev)
      const digits = raw.replace(/[^\d]/g, '')

      if (field === 'monto_orden') {
        const mo = parseFloat(digits) || 0
        const am = parseFloat(cur.anticipo_monto) || 0
        const newPct = mo > 0 && am > 0 ? String(Math.round((am / mo) * 100)) : cur.anticipo_pct
        next.set(proveedor, { ...cur, monto_orden: digits, anticipo_pct: newPct })
      } else if (field === 'anticipo_monto') {
        const mo  = parseFloat(cur.monto_orden) || 0
        const am  = parseFloat(digits) || 0
        const pct = mo > 0 && am > 0 ? String(Math.round((am / mo) * 100)) : ''
        next.set(proveedor, { ...cur, anticipo_monto: digits, anticipo_pct: pct })
      } else {
        // anticipo_pct → recalculate monto
        const mo     = parseFloat(cur.monto_orden) || 0
        const pctVal = Math.min(100, Math.max(0, parseFloat(digits) || 0))
        const am     = mo > 0 ? String(Math.round(mo * pctVal / 100)) : ''
        next.set(proveedor, { ...cur, anticipo_pct: digits, anticipo_monto: am })
      }
      return next
    })
  }

  function saveProvMontos(proveedor: string) {
    const d  = getProvData(proveedor)
    const mo = parseFmt(d.monto_orden)
    const am = parseFmt(d.anticipo_monto)
    startTransition(() => actualizarProveedorMontos(oe.id, proveedor, mo, am))
  }

  /* ── Agrupar ítems por proveedor ── */
  const gruposMap = useMemo(() => {
    const map = new Map<string, OEItem[]>()
    for (const item of items) {
      const key = item.proveedor ?? '—Sin proveedor—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [items])

  // Orden de grupos: inicializado según el mínimo `orden` de cada grupo
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    const entries = Array.from(gruposMap.entries())
    return entries
      .sort(([, a], [, b]) => Math.min(...a.map(i => i.orden)) - Math.min(...b.map(i => i.orden)))
      .map(([key]) => key)
  })

  // Sincronizar groupOrder cuando aparezcan nuevos grupos
  const allGroupKeys = Array.from(gruposMap.keys())
  const syncedOrder  = [
    ...groupOrder.filter(k => gruposMap.has(k)),
    ...allGroupKeys.filter(k => !groupOrder.includes(k)),
  ]

  function moveGroup(provKey: string, dir: 'up' | 'down') {
    const idx = syncedOrder.indexOf(provKey)
    if (dir === 'up'   && idx <= 0)                    return
    if (dir === 'down' && idx >= syncedOrder.length - 1) return
    const next  = [...syncedOrder]
    const swap  = dir === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setGroupOrder(next)

    // Recompute global order for all items
    const reorderedIds: string[] = []
    for (const key of next) {
      const groupItems = gruposMap.get(key) ?? []
      reorderedIds.push(...groupItems.map(i => i.id))
    }
    startTransition(() => reordenarItems(oe.id, reorderedIds))
  }

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
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span>📦</span>
            <h2 className="font-semibold text-gray-800">Pedidos a proveedores</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {totalBodega}/{totalItems} en bodega
          </span>
        </div>

        <div className="space-y-4">
          {syncedOrder.map((provKey, groupIdx) => {
            const groupItems = gruposMap.get(provKey)
            if (!groupItems) return null

            const esSinProv      = provKey === '—Sin proveedor—'
            const proveedor      = esSinProv ? null : provKey
            const anticipoPagado = groupItems.every(i => i.anticipo_proveedor_pagado)
            const todosEnBodega  = groupItems.every(i => i.estado === 'en_bodega')

            // Costo total calculado desde los ítems
            const costoCalculado = groupItems.reduce((sum, it) => {
              const cop = it.moneda_costo === 'USD' ? it.costo_unitario * (it.trm ?? 1) : it.costo_unitario
              return sum + it.cantidad * cop
            }, 0)

            const provData        = esSinProv ? null : getProvData(provKey)
            const montoOrden      = provData ? parseFmt(provData.monto_orden)    : 0
            const anticipoGirado  = provData ? parseFmt(provData.anticipo_monto) : 0
            const faltaPagar      = Math.max(0, montoOrden - anticipoGirado)
            const pctAnticipoProv = montoOrden > 0 ? Math.round((anticipoGirado / montoOrden) * 100) : 0

            return (
              <div
                key={provKey}
                className={`rounded-xl border overflow-hidden shadow-sm ${
                  todosEnBodega
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* ── Cabecera del proveedor ── */}
                <div className={`px-5 py-3 border-b flex flex-wrap items-start gap-4 ${
                  todosEnBodega ? 'bg-emerald-100/40 border-emerald-200' : 'bg-gray-50 border-gray-200'
                }`}>

                  {/* ▲▼ + nombre + costo total */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button type="button" onClick={() => moveGroup(provKey, 'up')}
                        disabled={groupIdx === 0}
                        className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[11px] leading-none px-0.5"
                        title="Subir proveedor">▲</button>
                      <button type="button" onClick={() => moveGroup(provKey, 'down')}
                        disabled={groupIdx === syncedOrder.length - 1}
                        className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[11px] leading-none px-0.5"
                        title="Bajar proveedor">▼</button>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold uppercase tracking-widest ${esSinProv ? 'text-gray-400' : 'text-gray-800'}`}>
                          {esSinProv ? 'Sin proveedor' : provKey}
                        </span>
                        <span className="text-xs text-gray-400">{groupItems.length} ítem{groupItems.length !== 1 ? 's' : ''}</span>
                        {todosEnBodega && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">✓ En bodega</span>
                        )}
                      </div>
                      {/* Costo total calculado */}
                      {costoCalculado > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Costo equipos: <span className="font-bold text-gray-700">${fmt(Math.round(costoCalculado))}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Montos financieros */}
                  {!esSinProv && provData !== null && (
                    <div className="flex flex-wrap items-end gap-3 flex-1">

                      {/* Monto orden compra */}
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Monto orden compra</p>
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-gray-400 text-xs">$</span>
                          <input
                            type="text" inputMode="numeric"
                            value={provData.monto_orden ? Number(parseFmt(provData.monto_orden)).toLocaleString('es-CO') : ''}
                            onChange={e => setProvField(provKey, 'monto_orden', e.target.value)}
                            onBlur={() => saveProvMontos(provKey)}
                            placeholder="0"
                            className="pl-6 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right w-36 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                      </div>

                      {/* Anticipo % */}
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Anticipo %</p>
                        <div className="relative flex items-center">
                          <input
                            type="text" inputMode="numeric"
                            value={provData.anticipo_pct}
                            onChange={e => setProvField(provKey, 'anticipo_pct', e.target.value)}
                            onBlur={() => saveProvMontos(provKey)}
                            placeholder="0"
                            className="pl-3 pr-6 py-1.5 border border-gray-200 rounded-lg text-sm text-right w-20 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                          <span className="absolute right-2.5 text-gray-400 text-xs pointer-events-none">%</span>
                        </div>
                      </div>

                      {/* Anticipo $ */}
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Anticipo girado $</p>
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-gray-400 text-xs">$</span>
                          <input
                            type="text" inputMode="numeric"
                            value={provData.anticipo_monto ? Number(parseFmt(provData.anticipo_monto)).toLocaleString('es-CO') : ''}
                            onChange={e => setProvField(provKey, 'anticipo_monto', e.target.value)}
                            onBlur={() => saveProvMontos(provKey)}
                            placeholder="0"
                            className="pl-6 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right w-36 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                      </div>

                      {/* Falta por girar */}
                      {montoOrden > 0 && (
                        <div className="pb-1">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Falta por girar</p>
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-gray-800 text-sm">${fmt(faltaPagar)}</span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                              pctAnticipoProv >= 100 ? 'bg-emerald-100 text-emerald-700'
                              : pctAnticipoProv >= 50 ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-500'
                            }`}>{pctAnticipoProv}% girado</span>
                          </div>
                        </div>
                      )}

                      {/* Toggle anticipo */}
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
                          <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center text-[9px] shrink-0 ${
                            anticipoPagado ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                          }`}>{anticipoPagado && '✓'}</span>
                          Anticipo confirmado
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Ítems del grupo ── */}
                <div className="divide-y divide-gray-100">
                  {groupItems.map(item => {
                    const costoCOP  = item.moneda_costo === 'USD' ? item.costo_unitario * (item.trm ?? 1) : item.costo_unitario
                    const costoItem = Math.round(item.cantidad * costoCOP)

                    return (
                      <div
                        key={item.id}
                        className={`px-5 py-3 ${item.estado === 'en_bodega' ? 'opacity-60' : ''}`}
                      >
                        <div className="flex flex-wrap items-center gap-3">

                          {/* Referencia + costo (sin descripción) */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-gray-400 text-xs font-semibold shrink-0">×{item.cantidad}</span>
                            <p className="text-sm font-bold text-gray-800 font-mono">
                              {item.referencia ?? <span className="text-gray-400 font-normal italic text-xs">Sin ref.</span>}
                            </p>
                            {costoItem > 0 && (
                              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                                ${fmt(costoItem)}
                              </span>
                            )}
                          </div>

                          {/* Estado */}
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs shrink-0">
                            {ESTADOS.map(s => (
                              <button key={s} type="button"
                                onClick={() => handleItemEstado(item.id, s)}
                                className={`px-3 py-1.5 font-medium transition-colors ${
                                  item.estado === s ? ESTADO_ACTIVE[s] : ESTADO_INACTIVE
                                }`}>
                                {ESTADO_LABEL[s]}
                              </button>
                            ))}
                          </div>

                          {/* Fecha solicitud */}
                          <div className="shrink-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Solicitud</p>
                            <input type="date"
                              value={item.fecha_solicitud ?? ''}
                              onChange={e => handleFechaSolicitud(item.id, e.target.value)}
                              className="px-2 py-1 border border-dashed border-gray-300 rounded text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-solid w-34"
                            />
                          </div>

                          {/* Fecha entrega */}
                          <div className="shrink-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Entrega en bodega</p>
                            <input type="date"
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
