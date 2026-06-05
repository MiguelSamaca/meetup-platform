import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { Suspense } from 'react'
import Link from 'next/link'
import VistaPagarSelector from '@/components/admin/finanzas/VistaPagarSelector'
import PagarAcciones from '@/components/admin/finanzas/PagarAcciones'

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type EstadoPago = 'sin_anticipo' | 'anticipo_pendiente' | 'anticipo_girado' | 'saldo_pendiente' | 'liquidado'

function calcEstadoPago(
  montoOrden: number,
  anticipoMonto: number,
  anticipoPagado: boolean,
  todosBodega: boolean,
): EstadoPago {
  if (todosBodega && anticipoPagado) return 'liquidado'
  if (anticipoMonto === 0)           return 'sin_anticipo'
  if (!anticipoPagado)               return 'anticipo_pendiente'
  if (montoOrden > anticipoMonto)    return 'saldo_pendiente'
  return 'anticipo_girado'
}

function EstadoBadge({ estado }: { estado: EstadoPago }) {
  const map: Record<EstadoPago, { label: string; cls: string }> = {
    sin_anticipo:     { label: 'Sin anticipo',     cls: 'bg-gray-100 text-gray-400'       },
    anticipo_pendiente:{ label: '⏳ Anticipo pend.',cls: 'bg-amber-100 text-amber-700'     },
    anticipo_girado:  { label: '✓ Anticipo girado',cls: 'bg-blue-100 text-blue-700'        },
    saldo_pendiente:  { label: 'Saldo pendiente',  cls: 'bg-orange-100 text-orange-700'    },
    liquidado:        { label: '✓ Liquidado',       cls: 'bg-emerald-100 text-emerald-700' },
  }
  const { label, cls } = map[estado]
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

/* ── Page ── */
export default async function PagarPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>
}) {
  const { vista: vistaParam } = await searchParams
  const vista    = vistaParam === 'oe' ? 'oe' : 'proveedor'
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const tid      = profile?.tenant_id!

  /* ── Datos ── */
  const [
    { data: proveedores },
    { data: oes },
    { data: items },
  ] = await Promise.all([
    supabase
      .from('oe_proveedores')
      .select('orden_ejecucion_id, proveedor, monto_orden, anticipo_monto'),
    supabase
      .from('ordenes_ejecucion')
      .select('id, consecutivo, contacto_id')
      .eq('tenant_id', tid),
    supabase
      .from('oe_items')
      .select('orden_ejecucion_id, proveedor, estado, anticipo_proveedor_pagado'),
  ])

  /* Filtrar OEs del tenant */
  const oeIds   = new Set((oes ?? []).map(o => o.id))
  const provsFilt = (proveedores ?? []).filter(p => oeIds.has(p.orden_ejecucion_id))

  /* Mapa de OE info */
  const oeMap = new Map((oes ?? []).map(o => [o.id, o]))

  /* Contactos */
  const contactoIds = [...new Set((oes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await supabase.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const contactoMap = new Map((contactos ?? []).map(c => [c.id, c.nombre]))

  /* Enriquecer cada prov ── */
  const rows = provsFilt.map(p => {
    const oeItems = (items ?? []).filter(
      i => i.orden_ejecucion_id === p.orden_ejecucion_id && i.proveedor === p.proveedor,
    )
    const anticipoPagado = oeItems.length > 0 && oeItems.every(i => i.anticipo_proveedor_pagado)
    const todosBodega    = oeItems.length > 0 && oeItems.every(i => i.estado === 'en_bodega')
    const saldoMonto     = Math.max(0, (p.monto_orden ?? 0) - (p.anticipo_monto ?? 0))
    const estado         = calcEstadoPago(p.monto_orden ?? 0, p.anticipo_monto ?? 0, anticipoPagado, todosBodega)
    const oe             = oeMap.get(p.orden_ejecucion_id)

    return {
      ...p,
      anticipoPagado,
      todosBodega,
      saldoMonto,
      estado,
      consecutivo:    oe?.consecutivo ?? '—',
      contactoNombre: contactoMap.get(oe?.contacto_id ?? '') ?? '—',
    }
  })

  /* ── KPIs globales ── */
  const totOrden     = rows.reduce((s, r) => s + (r.monto_orden ?? 0), 0)
  const totAnticipo  = rows.reduce((s, r) => s + (r.anticipo_monto ?? 0), 0)
  const totSaldo     = rows.reduce((s, r) => s + r.saldoMonto, 0)
  const totGirado    = rows.filter(r => r.anticipoPagado).reduce((s, r) => s + (r.anticipo_monto ?? 0), 0)
  const totPendPagar = totAnticipo - totGirado + rows.filter(r => !r.todosBodega).reduce((s, r) => s + r.saldoMonto, 0)

  /* ── Vista Por Proveedor: agrupar ── */
  const porProveedor = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = r.proveedor ?? '(Sin proveedor)'
    const arr = porProveedor.get(key) ?? []
    arr.push(r)
    porProveedor.set(key, arr)
  }
  const proveedoresList = Array.from(porProveedor.entries())
    .map(([nombre, rs]) => ({
      nombre,
      totalOrden:    rs.reduce((s, r) => s + (r.monto_orden ?? 0), 0),
      totalAnticipo: rs.reduce((s, r) => s + (r.anticipo_monto ?? 0), 0),
      totalSaldo:    rs.reduce((s, r) => s + r.saldoMonto, 0),
      anticiposGirados: rs.filter(r => r.anticipoPagado).length,
      totalOEs:      rs.length,
      rows:          rs,
    }))
    .sort((a, b) => b.totalOrden - a.totalOrden)

  /* ── Vista Por OE: agrupar ── */
  const porOE = new Map<string, typeof rows>()
  for (const r of rows) {
    const arr = porOE.get(r.orden_ejecucion_id) ?? []
    arr.push(r)
    porOE.set(r.orden_ejecucion_id, arr)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/finanzas" className="text-gray-400 hover:text-gray-600 text-sm">← Finanzas</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas por pagar</h1>
          <p className="text-sm text-gray-500 mt-1">Seguimiento de pagos a proveedores por orden de ejecución</p>
        </div>
        <Suspense>
          <VistaPagarSelector />
        </Suspense>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total órdenes compra', valor: `$${fmt(totOrden)}`,    color: 'text-gray-900',    icon: '📦' },
          { label: 'Total anticipos',      valor: `$${fmt(totAnticipo)}`, color: 'text-blue-700',    icon: '💳' },
          { label: 'Anticipos girados',    valor: `$${fmt(totGirado)}`,   color: 'text-emerald-600', icon: '✅' },
          { label: 'Pendiente por pagar',  valor: `$${fmt(totPendPagar)}`,color: totPendPagar > 0 ? 'text-amber-600' : 'text-gray-400', icon: '⏳' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{k.label}</p>
              <span className="text-xl">{k.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* ── VISTA POR PROVEEDOR ── */}
      {vista === 'proveedor' && (
        <div className="space-y-4">
          {proveedoresList.map(prov => (
            <div key={prov.nombre} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header proveedor */}
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{prov.nombre}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {prov.totalOEs} OE{prov.totalOEs !== 1 ? 's' : ''} ·{' '}
                    {prov.anticiposGirados} anticipo{prov.anticiposGirados !== 1 ? 's' : ''} girado{prov.anticiposGirados !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-xs text-gray-400">Total órdenes</p>
                    <p className="font-bold text-gray-900">${fmt(prov.totalOrden)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Anticipos</p>
                    <p className="font-bold text-blue-700">${fmt(prov.totalAnticipo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Saldos</p>
                    <p className="font-bold text-amber-600">${fmt(prov.totalSaldo)}</p>
                  </div>
                </div>
              </div>
              {/* Filas OE */}
              <table className="w-full text-sm">
                <thead className="border-b border-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">OE</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">Cliente</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Orden compra</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Anticipo</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Saldo</th>
                    <th className="text-center px-5 py-2.5 text-xs font-semibold text-gray-400">Estado</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {prov.rows.map(r => (
                    <tr key={`${r.orden_ejecucion_id}-${r.proveedor}`} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link href={`/admin/ordenes/${r.orden_ejecucion_id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                          {r.consecutivo}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{r.contactoNombre}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">${fmt(r.monto_orden ?? 0)}</td>
                      <td className="px-5 py-3 text-right text-blue-700">${fmt(r.anticipo_monto ?? 0)}</td>
                      <td className="px-5 py-3 text-right text-amber-600">
                        {r.saldoMonto > 0 ? `$${fmt(r.saldoMonto)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center"><EstadoBadge estado={r.estado} /></td>
                      <td className="px-4 py-3">
                        {r.proveedor && (r.anticipo_monto ?? 0) > 0 && r.estado !== 'liquidado' && (
                          <PagarAcciones
                            oeId={r.orden_ejecucion_id}
                            proveedor={r.proveedor}
                            anticipoPagado={r.anticipoPagado}
                            anticipoMonto={r.anticipo_monto ?? 0}
                            saldoMonto={r.saldoMonto}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {proveedoresList.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
              <p>Sin proveedores registrados en órdenes de ejecución.</p>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA POR OE ── */}
      {vista === 'oe' && (
        <div className="space-y-4">
          {Array.from(porOE.entries()).map(([oeId, provRows]) => {
            const oe          = oeMap.get(oeId)
            const totOE       = provRows.reduce((s, r) => s + (r.monto_orden ?? 0), 0)
            const totAntOE    = provRows.reduce((s, r) => s + (r.anticipo_monto ?? 0), 0)
            const totSaldoOE  = provRows.reduce((s, r) => s + r.saldoMonto, 0)

            return (
              <div key={oeId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header OE */}
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <Link href={`/admin/ordenes/${oeId}`} className="font-mono font-bold text-blue-700 hover:underline text-sm">
                      {provRows[0]?.consecutivo}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{provRows[0]?.contactoNombre}</p>
                  </div>
                  <div className="flex gap-6 text-right text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Total proveedores</p>
                      <p className="font-bold text-gray-900">${fmt(totOE)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Anticipos</p>
                      <p className="font-bold text-blue-700">${fmt(totAntOE)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Saldos</p>
                      <p className="font-bold text-amber-600">${fmt(totSaldoOE)}</p>
                    </div>
                  </div>
                </div>
                {/* Proveedores de la OE */}
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-50">
                    {provRows.map(r => (
                      <tr key={r.proveedor} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-800 w-48">{r.proveedor}</td>
                        <td className="px-5 py-3 text-right text-gray-900">${fmt(r.monto_orden ?? 0)}</td>
                        <td className="px-5 py-3 text-right text-blue-700">${fmt(r.anticipo_monto ?? 0)}</td>
                        <td className="px-5 py-3 text-right text-amber-600">
                          {r.saldoMonto > 0 ? `$${fmt(r.saldoMonto)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-center"><EstadoBadge estado={r.estado} /></td>
                        <td className="px-4 py-3">
                          {r.proveedor && (r.anticipo_monto ?? 0) > 0 && r.estado !== 'liquidado' && (
                            <PagarAcciones
                              oeId={r.orden_ejecucion_id}
                              proveedor={r.proveedor}
                              anticipoPagado={r.anticipoPagado}
                              anticipoMonto={r.anticipo_monto ?? 0}
                              saldoMonto={r.saldoMonto}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}

          {porOE.size === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
              <p>Sin órdenes de ejecución con proveedores registrados.</p>
            </div>
          )}
        </div>
      )}

      {/* Footer totales globales */}
      {rows.length > 0 && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 flex gap-8">
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">Total órdenes</p>
            <p className="text-xl font-bold text-gray-900">${fmt(totOrden)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">Total anticipos</p>
            <p className="text-xl font-bold text-blue-700">${fmt(totAnticipo)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">Anticipos girados</p>
            <p className="text-xl font-bold text-emerald-600">${fmt(totGirado)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">Total saldos</p>
            <p className="text-xl font-bold text-amber-600">${fmt(totSaldo)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
