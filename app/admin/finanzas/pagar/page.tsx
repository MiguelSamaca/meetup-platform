import { createAdminClient }    from '@/lib/supabase/admin'
import { getCurrentProfile }     from '@/lib/auth'
import { Suspense }              from 'react'
import Link                      from 'next/link'
import VistaPagarSelector        from '@/components/admin/finanzas/VistaPagarSelector'
import PagarAcciones             from '@/components/admin/finanzas/PagarAcciones'

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
    sin_anticipo:      { label: 'Sin anticipo',      cls: 'bg-gray-100 text-gray-400'       },
    anticipo_pendiente:{ label: '⏳ Anticipo pend.',  cls: 'bg-amber-100 text-amber-700'     },
    anticipo_girado:   { label: '✓ Anticipo girado',  cls: 'bg-blue-100 text-blue-700'       },
    saldo_pendiente:   { label: 'Saldo pendiente',    cls: 'bg-orange-100 text-orange-700'   },
    liquidado:         { label: '✓ Liquidado',         cls: 'bg-emerald-100 text-emerald-700' },
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

  const oeIds     = new Set((oes ?? []).map(o => o.id))
  const provsFilt = (proveedores ?? []).filter(p => oeIds.has(p.orden_ejecucion_id))
  const oeMap     = new Map((oes ?? []).map(o => [o.id, o]))

  /* Contactos */
  const contactoIds = [...new Set((oes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await supabase.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const contactoMap = new Map((contactos ?? []).map(c => [c.id, c.nombre]))

  /* ── Enriquecer cada fila con desglose IVA ── */
  const rows = provsFilt.map(p => {
    const oeItems       = (items ?? []).filter(
      i => i.orden_ejecucion_id === p.orden_ejecucion_id && i.proveedor === p.proveedor,
    )
    const anticipoPagado = oeItems.length > 0 && oeItems.every(i => i.anticipo_proveedor_pagado)
    const todosBodega    = oeItems.length > 0 && oeItems.every(i => i.estado === 'en_bodega')
    const oe             = oeMap.get(p.orden_ejecucion_id)

    // ── Bases (sin IVA) ──
    const montoBase    = p.monto_orden    ?? 0
    const anticipoBase = p.anticipo_monto ?? 0
    const saldoBase    = Math.max(0, montoBase - anticipoBase)

    // ── IVA (19 %) ──
    const ivaOrden    = Math.round(montoBase    * 0.19)
    const ivaAnticipo = Math.round(anticipoBase * 0.19)
    const ivaSaldo    = Math.round(saldoBase    * 0.19)

    // ── Totales con IVA ──
    const totalConIva    = montoBase    + ivaOrden
    const anticipoConIva = anticipoBase + ivaAnticipo
    const saldoConIva    = saldoBase    + ivaSaldo

    const estado = calcEstadoPago(montoBase, anticipoBase, anticipoPagado, todosBodega)

    return {
      ...p,
      anticipoPagado, todosBodega,
      // bases
      montoBase, anticipoBase, saldoBase,
      // iva
      ivaOrden, ivaAnticipo, ivaSaldo,
      // totales c/IVA
      totalConIva, anticipoConIva, saldoConIva,
      estado,
      consecutivo:    oe?.consecutivo ?? '—',
      contactoNombre: contactoMap.get(oe?.contacto_id ?? '') ?? '—',
    }
  })

  /* ── KPIs globales (todos c/IVA) ── */
  const totOrdenConIva    = rows.reduce((s, r) => s + r.totalConIva,    0)
  const totAnticipoConIva = rows.reduce((s, r) => s + r.anticipoConIva, 0)
  const totGiradoConIva   = rows.filter(r => r.anticipoPagado).reduce((s, r) => s + r.anticipoConIva, 0)
  const totSaldoConIva    = rows.reduce((s, r) => s + r.saldoConIva,    0)

  // IVA total descontable (ya girado + pendiente)
  const ivaOrdenTotal    = rows.reduce((s, r) => s + r.ivaOrden,    0)
  const ivaGirado        = rows.filter(r => r.anticipoPagado).reduce((s, r) => s + r.ivaAnticipo, 0)
  const ivaPendAnticipo  = rows.filter(r => !r.anticipoPagado).reduce((s, r) => s + r.ivaAnticipo, 0)
  const ivaPendSaldo     = rows.filter(r => !r.todosBodega).reduce((s, r) => s + r.ivaSaldo, 0)
  const ivaPendTotal     = ivaPendAnticipo + ivaPendSaldo

  // Pendiente total c/IVA
  const totPendConIva =
    rows.filter(r => !r.anticipoPagado).reduce((s, r) => s + r.anticipoConIva, 0) +
    rows.filter(r => r.anticipoPagado && !r.todosBodega).reduce((s, r) => s + r.saldoConIva, 0)

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
      totalOrdenConIva:    rs.reduce((s, r) => s + r.totalConIva,    0),
      totalAnticipoConIva: rs.reduce((s, r) => s + r.anticipoConIva, 0),
      totalSaldoConIva:    rs.reduce((s, r) => s + r.saldoConIva,    0),
      ivaTotal:            rs.reduce((s, r) => s + r.ivaOrden,       0),
      anticiposGirados:    rs.filter(r => r.anticipoPagado).length,
      totalOEs:            rs.length,
      rows:                rs,
    }))
    .sort((a, b) => b.totalOrdenConIva - a.totalOrdenConIva)

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
          <p className="text-sm text-gray-500 mt-1">
            Pagos a proveedores · valores con IVA discriminado (19%)
          </p>
        </div>
        <Suspense>
          <VistaPagarSelector />
        </Suspense>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          {
            label: 'Total órdenes c/IVA',
            valor: `$${fmt(totOrdenConIva)}`,
            sub:   `Base $${fmt(totOrdenConIva - ivaOrdenTotal)} + IVA $${fmt(ivaOrdenTotal)}`,
            color: 'text-gray-900', icon: '📦',
          },
          {
            label: 'Anticipos c/IVA',
            valor: `$${fmt(totAnticipoConIva)}`,
            sub:   `IVA incluido: $${fmt(totAnticipoConIva - rows.reduce((s, r) => s + r.anticipoBase, 0))}`,
            color: 'text-blue-700', icon: '💳',
          },
          {
            label: 'Anticipos girados',
            valor: `$${fmt(totGiradoConIva)}`,
            sub:   `IVA descontable girado: $${fmt(ivaGirado)}`,
            color: 'text-emerald-600', icon: '✅',
          },
          {
            label: 'Pendiente por pagar',
            valor: `$${fmt(totPendConIva)}`,
            sub:   `IVA pend. descontable: $${fmt(ivaPendTotal)}`,
            color: totPendConIva > 0 ? 'text-amber-600' : 'text-gray-400', icon: '⏳',
          },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">{k.label}</p>
              <span className="text-xl">{k.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.valor}</p>
            <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Banner IVA descontable */}
      {ivaOrdenTotal > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3 mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-0.5">
              🏛️ IVA descontable de proveedores
            </p>
            <p className="text-sm text-violet-700">
              Total IVA en órdenes: <strong>${fmt(ivaOrdenTotal)}</strong>
              &nbsp;·&nbsp; Ya girado: <strong className="text-emerald-600">${fmt(ivaGirado)}</strong>
              &nbsp;·&nbsp; Pendiente de pagar: <strong className="text-amber-600">${fmt(ivaPendTotal)}</strong>
            </p>
          </div>
          <p className="text-xs text-violet-500 max-w-xs">
            El IVA pagado a proveedores se puede descontar del IVA generado en ventas al declarar ante la DIAN.
          </p>
        </div>
      )}

      {/* ── VISTA POR PROVEEDOR ── */}
      {vista === 'proveedor' && (
        <div className="space-y-4">
          {proveedoresList.map(prov => (
            <div key={prov.nombre} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header proveedor */}
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">{prov.nombre}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {prov.totalOEs} OE{prov.totalOEs !== 1 ? 's' : ''} ·{' '}
                    {prov.anticiposGirados} anticipo{prov.anticiposGirados !== 1 ? 's' : ''} girado{prov.anticiposGirados !== 1 ? 's' : ''} ·{' '}
                    IVA total: <span className="text-violet-600 font-semibold">${fmt(prov.ivaTotal)}</span>
                  </p>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-xs text-gray-400">Total c/IVA</p>
                    <p className="font-bold text-gray-900">${fmt(prov.totalOrdenConIva)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Anticipos c/IVA</p>
                    <p className="font-bold text-blue-700">${fmt(prov.totalAnticipoConIva)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Saldos c/IVA</p>
                    <p className="font-bold text-amber-600">${fmt(prov.totalSaldoConIva)}</p>
                  </div>
                </div>
              </div>
              {/* Filas OE */}
              <table className="w-full text-sm">
                <thead className="border-b border-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">OE</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">Cliente</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Orden c/IVA</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Anticipo c/IVA</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Saldo c/IVA</th>
                    <th className="text-center px-5 py-2.5 text-xs font-semibold text-gray-400">Estado</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {prov.rows.map(r => (
                    <tr key={`${r.orden_ejecucion_id}-${r.proveedor}`} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link href={`/admin/ordenes/${r.orden_ejecucion_id}`}
                          className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                          {r.consecutivo}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{r.contactoNombre}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">${fmt(r.totalConIva)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-blue-700">${fmt(r.anticipoConIva)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-amber-600">
                        {r.saldoConIva > 0 ? `$${fmt(r.saldoConIva)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center"><EstadoBadge estado={r.estado} /></td>
                      <td className="px-4 py-3">
                        {r.proveedor && (r.anticipo_monto ?? 0) > 0 && r.estado !== 'liquidado' && (
                          <PagarAcciones
                            oeId={r.orden_ejecucion_id}
                            proveedor={r.proveedor}
                            anticipoPagado={r.anticipoPagado}
                            anticipoMonto={r.anticipo_monto ?? 0}
                            saldoMonto={r.saldoBase}
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
            const totOEConIva  = provRows.reduce((s, r) => s + r.totalConIva,    0)
            const totAntConIva = provRows.reduce((s, r) => s + r.anticipoConIva, 0)
            const totSalConIva = provRows.reduce((s, r) => s + r.saldoConIva,    0)
            const ivaOE        = provRows.reduce((s, r) => s + r.ivaOrden,       0)

            return (
              <div key={oeId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header OE */}
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <Link href={`/admin/ordenes/${oeId}`}
                      className="font-mono font-bold text-blue-700 hover:underline text-sm">
                      {provRows[0]?.consecutivo}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {provRows[0]?.contactoNombre} ·{' '}
                      IVA total: <span className="text-violet-600 font-semibold">${fmt(ivaOE)}</span>
                    </p>
                  </div>
                  <div className="flex gap-6 text-right text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Total c/IVA</p>
                      <p className="font-bold text-gray-900">${fmt(totOEConIva)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Anticipos c/IVA</p>
                      <p className="font-bold text-blue-700">${fmt(totAntConIva)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Saldos c/IVA</p>
                      <p className="font-bold text-amber-600">${fmt(totSalConIva)}</p>
                    </div>
                  </div>
                </div>
                {/* Proveedores de la OE */}
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-50 bg-white">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400">Proveedor</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Orden c/IVA</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Anticipo c/IVA</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400">Saldo c/IVA</th>
                      <th className="text-center px-5 py-2.5 text-xs font-semibold text-gray-400">Estado</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-gray-400">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {provRows.map(r => (
                      <tr key={r.proveedor} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-800">{r.proveedor}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">${fmt(r.totalConIva)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-blue-700">${fmt(r.anticipoConIva)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-amber-600">
                          {r.saldoConIva > 0 ? `$${fmt(r.saldoConIva)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-center"><EstadoBadge estado={r.estado} /></td>
                        <td className="px-4 py-3">
                          {r.proveedor && (r.anticipo_monto ?? 0) > 0 && r.estado !== 'liquidado' && (
                            <PagarAcciones
                              oeId={r.orden_ejecucion_id}
                              proveedor={r.proveedor}
                              anticipoPagado={r.anticipoPagado}
                              anticipoMonto={r.anticipo_monto ?? 0}
                              saldoMonto={r.saldoBase}
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
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Resumen global c/IVA</p>
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Total órdenes</p>
              <p className="text-xl font-bold text-gray-900">${fmt(totOrdenConIva)}</p>
              <p className="text-xs text-violet-500">IVA: ${fmt(ivaOrdenTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Total anticipos</p>
              <p className="text-xl font-bold text-blue-700">${fmt(totAnticipoConIva)}</p>
              <p className="text-xs text-violet-500">IVA: ${fmt(totAnticipoConIva - rows.reduce((s, r) => s + r.anticipoBase, 0))}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Anticipos girados</p>
              <p className="text-xl font-bold text-emerald-600">${fmt(totGiradoConIva)}</p>
              <p className="text-xs text-violet-500">IVA descontable: ${fmt(ivaGirado)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Total saldos</p>
              <p className="text-xl font-bold text-amber-600">${fmt(totSaldoConIva)}</p>
              <p className="text-xs text-violet-500">IVA pendiente: ${fmt(ivaPendSaldo)}</p>
            </div>
            <div className="border-l border-gray-300 pl-8">
              <p className="text-xs text-violet-600 uppercase font-semibold">IVA descontable total</p>
              <p className="text-xl font-bold text-violet-700">${fmt(ivaOrdenTotal)}</p>
              <p className="text-xs text-violet-500">
                Girado: ${fmt(ivaGirado)} · Pendiente: ${fmt(ivaPendTotal)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
