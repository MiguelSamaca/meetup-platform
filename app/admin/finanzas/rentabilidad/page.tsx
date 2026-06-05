import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile }  from '@/lib/auth'
import Link                   from 'next/link'
import ExportarRentabilidad   from '@/components/admin/finanzas/ExportarRentabilidad'

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/* ── Semáforo de margen (4.3) ── */
function MargenBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-gray-400">N/A</span>
  }
  const { cls, label } =
    pct >= 25 ? { cls: 'bg-emerald-100 text-emerald-700', label: `${pct.toFixed(1)}%` } :
    pct >= 15 ? { cls: 'bg-amber-100  text-amber-700',   label: `${pct.toFixed(1)}%` } :
                { cls: 'bg-red-100    text-red-700',      label: `▼ ${pct.toFixed(1)}%` }
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

/* ── Barra de margen visual ── */
function MargenBar({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const clamped = Math.max(0, Math.min(100, pct))
  const color   = pct >= 25 ? 'bg-emerald-400' : pct >= 15 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

/* ── Page ── */
export default async function RentabilidadPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const tid      = profile?.tenant_id!

  /* ── Datos base ── */
  const [
    { data: proyectos },
    { data: oes },
    { data: gastosTodos },
  ] = await Promise.all([
    supabase
      .from('proyectos')
      .select('id, nombre, estado, orden_ejecucion_id, fecha_inicio')
      .eq('tenant_id', tid)
      .order('fecha_inicio', { ascending: false }),
    supabase
      .from('ordenes_ejecucion')
      .select('id, cotizacion_id, total_cotizacion')
      .eq('tenant_id', tid),
    supabase
      .from('gastos')
      .select('proyecto_id, monto')
      .eq('tenant_id', tid),
  ])

  /* ── Mapas rápidos ── */
  const oeMap  = new Map((oes ?? []).map(o => [o.id, o]))

  /* ── Cotizaciones únicas para los proyectos con OE ── */
  const cotIds = [...new Set(
    (proyectos ?? [])
      .map(p => p.orden_ejecucion_id ? oeMap.get(p.orden_ejecucion_id)?.cotizacion_id : null)
      .filter(Boolean) as string[]
  )]

  const { data: cotItems } = cotIds.length > 0
    ? await supabase
        .from('cotizacion_items')
        .select('cotizacion_id, precio_unitario, descuento, cantidad, costo_unitario, moneda_costo, trm')
        .in('cotizacion_id', cotIds)
    : { data: [] }

  /* Agrupar items por cotización */
  const itemsByCot = new Map<string, typeof cotItems>()
  for (const ci of cotItems ?? []) {
    const arr = itemsByCot.get(ci.cotizacion_id) ?? []
    arr.push(ci)
    itemsByCot.set(ci.cotizacion_id, arr)
  }

  /* Gastos por proyecto */
  const gastosByProy = new Map<string, number>()
  for (const g of gastosTodos ?? []) {
    gastosByProy.set(g.proyecto_id, (gastosByProy.get(g.proyecto_id) ?? 0) + (g.monto ?? 0))
  }

  /* ── Calcular P&L por proyecto ── */
  const rows = (proyectos ?? []).map(p => {
    const oe     = p.orden_ejecucion_id ? oeMap.get(p.orden_ejecucion_id) : null
    const cotId  = oe?.cotizacion_id ?? null
    const items  = cotId ? (itemsByCot.get(cotId) ?? []) : []

    let ingreso      = 0
    let costoEquipos = 0

    for (const it of items) {
      const bruto   = (it.precio_unitario ?? 0) * (it.cantidad ?? 1)
      const neto    = bruto * (1 - (it.descuento ?? 0) / 100)
      ingreso      += neto

      const costoCOP = it.moneda_costo === 'USD'
        ? (it.costo_unitario ?? 0) * (it.trm ?? 1)
        : (it.costo_unitario ?? 0)
      costoEquipos += costoCOP * (it.cantidad ?? 1)
    }

    ingreso      = Math.round(ingreso)
    costoEquipos = Math.round(costoEquipos)

    const gastosAdc  = Math.round(gastosByProy.get(p.id) ?? 0)
    const margenBruto = ingreso - costoEquipos - gastosAdc
    const pctMargen   = ingreso > 0 ? (margenBruto / ingreso) * 100 : null
    const tieneData   = items.length > 0

    return {
      id:          p.id,
      nombre:      p.nombre,
      estado:      p.estado,
      fechaInicio: p.fecha_inicio,
      oeId:        p.orden_ejecucion_id,
      ingreso,
      costoEquipos,
      gastosAdc,
      margenBruto,
      pctMargen:   tieneData ? pctMargen : null,
      tieneData,
      itemsCount:  items.length,
    }
  })

  /* ── Totales generales ── */
  const withData    = rows.filter(r => r.tieneData)
  const totIngreso  = withData.reduce((s, r) => s + r.ingreso,      0)
  const totCosto    = withData.reduce((s, r) => s + r.costoEquipos, 0)
  const totGastos   = rows.reduce((s, r) => s + r.gastosAdc, 0)
  const totMargen   = totIngreso - totCosto - totGastos
  const pctGlobal   = totIngreso > 0 ? (totMargen / totIngreso) * 100 : null

  /* ── Conteos semáforo ── */
  const verde    = withData.filter(r => (r.pctMargen ?? 0) >= 25).length
  const amarillo = withData.filter(r => (r.pctMargen ?? 0) >= 15 && (r.pctMargen ?? 0) < 25).length
  const rojo     = withData.filter(r => r.pctMargen !== null && (r.pctMargen ?? 0) < 15).length

  /* ── Para exportar ── */
  const filaExport = rows.map(r => ({
    proyecto:    r.nombre,
    estado:      r.estado,
    ingreso:     r.ingreso,
    costoEquipos: r.costoEquipos,
    gastos:      r.gastosAdc,
    margenBruto: r.margenBruto,
    pctMargen:   r.pctMargen,
  }))

  const ESTADO_LABEL: Record<string, string> = {
    activo: 'Activo', pausado: 'Pausado', completado: 'Completado', cancelado: 'Cancelado',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/finanzas" className="text-gray-400 hover:text-gray-600 text-sm">← Finanzas</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rentabilidad por proyecto</h1>
          <p className="text-sm text-gray-500 mt-1">
            P&amp;L real: ingreso venta · costo equipos · gastos adicionales
          </p>
        </div>
        <ExportarRentabilidad filas={filaExport} />
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ingreso total</p>
          <p className="text-2xl font-bold text-gray-900">${fmt(totIngreso)}</p>
          <p className="text-xs text-gray-400 mt-1">{withData.length} proyectos con datos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Costo equipos</p>
          <p className="text-2xl font-bold text-blue-700">${fmt(totCosto)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {totIngreso > 0 ? `${((totCosto / totIngreso) * 100).toFixed(1)}% del ingreso` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Margen bruto total</p>
          <p className={`text-2xl font-bold ${totMargen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${fmt(totMargen)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <MargenBar pct={pctGlobal} />
            <MargenBadge pct={pctGlobal} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Semáforo</p>
          <div className="flex gap-3 items-center">
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{verde}</p>
              <p className="text-[10px] text-gray-400">≥25%</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-500">{amarillo}</p>
              <p className="text-[10px] text-gray-400">15–25%</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{rojo}</p>
              <p className="text-[10px] text-gray-400">&lt;15%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla P&L */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Proyecto</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ingreso venta</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Costo equipos</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Gastos adic.</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Margen bruto</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">% Margen</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(r => (
              <tr
                key={r.id}
                className={`hover:bg-gray-50 transition-colors ${
                  r.pctMargen !== null && r.pctMargen < 15 ? 'bg-red-50/30' : ''
                }`}
              >
                <td className="px-5 py-3">
                  <Link href={`/admin/proyectos/${r.id}`} className="font-semibold text-gray-800 hover:text-emerald-600 hover:underline">
                    {r.nombre}
                  </Link>
                  {r.fechaInicio && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.fechaInicio + 'T12:00:00').toLocaleDateString('es-CO')}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.estado === 'activo'     ? 'bg-emerald-100 text-emerald-700' :
                    r.estado === 'completado' ? 'bg-blue-100 text-blue-700' :
                    r.estado === 'pausado'    ? 'bg-amber-100 text-amber-700' :
                                               'bg-gray-100 text-gray-500'
                  }`}>
                    {ESTADO_LABEL[r.estado] ?? r.estado}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                  {r.tieneData ? `$${fmt(r.ingreso)}` : <span className="text-gray-300 text-xs">Sin OE</span>}
                </td>
                <td className="px-5 py-3 text-right text-blue-700">
                  {r.tieneData ? `$${fmt(r.costoEquipos)}` : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-5 py-3 text-right text-red-600">
                  {r.gastosAdc > 0 ? `$${fmt(r.gastosAdc)}` : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  {r.tieneData ? (
                    <span className={`font-bold ${r.margenBruto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${fmt(r.margenBruto)}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <MargenBadge pct={r.pctMargen} />
                    <MargenBar   pct={r.pctMargen} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/proyectos/${r.id}`}
                    className="text-xs text-gray-400 hover:text-emerald-600 hover:underline whitespace-nowrap"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Sin proyectos registrados.
                </td>
              </tr>
            )}
          </tbody>
          {withData.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">
                  Total ({withData.length} proyectos con datos)
                </td>
                <td className="px-5 py-3 text-right font-bold text-gray-900">${fmt(totIngreso)}</td>
                <td className="px-5 py-3 text-right font-bold text-blue-700">${fmt(totCosto)}</td>
                <td className="px-5 py-3 text-right font-bold text-red-600">${fmt(totGastos)}</td>
                <td className="px-5 py-3 text-right font-bold text-emerald-600">${fmt(totMargen)}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <MargenBadge pct={pctGlobal} />
                    <MargenBar   pct={pctGlobal} />
                  </div>
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Leyenda semáforo */}
      <div className="mt-4 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"/>&nbsp;≥ 25% — Excelente</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400  inline-block"/>&nbsp;15–25% — Aceptable</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400    inline-block"/>&nbsp;&lt; 15% — Revisar</span>
      </div>
    </div>
  )
}
