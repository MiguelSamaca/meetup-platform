import { createAdminClient }                  from '@/lib/supabase/admin'
import { getCurrentProfile }                   from '@/lib/auth'
import Link                                    from 'next/link'
import SaldoCajaEditor                         from '@/components/admin/finanzas/SaldoCajaEditor'
import { getPeriodoIVA, type IVAPeriodicidad } from '@/lib/iva-colombia'

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function mesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}
function toMes(fecha: string | null): string {
  if (!fecha) return 'sin_fecha'
  return fecha.slice(0, 7)
}

/* ── Tipos ── */
interface Movimiento {
  tipo:         'entrada' | 'salida'
  concepto:     string
  detalle:      string
  monto:        number
  fecha:        string | null
  mes:          string
  oeId?:        string
  esGastoFijo?: boolean
  esIVA?:       boolean
}

/* ═══════════════════════════════════════════════════════════════ */
export default async function FlujoCajaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>
}) {
  const { vista } = await searchParams
  const vistaActual = vista === 'proyectos' ? 'proyectos' : 'general'

  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const tid      = profile?.tenant_id!
  const hoy      = new Date()
  const hoyStr   = hoy.toISOString().split('T')[0]
  const mesHoy   = hoyStr.slice(0, 7)

  /* ── Queries paralelas ── */
  const [
    { data: config },
    { data: gastosFijos },
    { data: oes },
    { data: proveedores },
    { data: gastos },
  ] = await Promise.all([
    supabase
      .from('tenant_config')
      .select('saldo_caja_actual, iva_periodicidad')
      .eq('tenant_id', tid)
      .maybeSingle(),
    supabase
      .from('gastos_fijos')
      .select('id, nombre, monto, categoria, activo')
      .eq('tenant_id', tid)
      .eq('activo', true)
      .order('categoria'),
    supabase
      .from('ordenes_ejecucion')
      .select(`
        id, consecutivo, total_cotizacion, total_con_iva,
        anticipo_porcentaje, anticipo_monto, anticipo_fecha, anticipo_recibido,
        saldo_fecha, saldo_recibido, contacto_id, estado, created_at
      `)
      .eq('tenant_id', tid),
    supabase
      .from('oe_proveedores')
      .select('orden_ejecucion_id, proveedor, monto_orden, anticipo_monto'),
    supabase
      .from('gastos')
      .select('id, proyecto_id, descripcion, monto, categoria, fecha')
      .eq('tenant_id', tid)
      .order('fecha'),
  ])

  const saldoCajaActual  = (config as any)?.saldo_caja_actual  ?? 0
  const ivaPeriodicidad: IVAPeriodicidad = (config as any)?.iva_periodicidad ?? 'cuatrimestral'
  const totalGastosFijos = (gastosFijos ?? []).reduce((s, g) => s + g.monto, 0)

  /* Gastos: separar pasados (para cálculo de caja) de futuros (para timeline) */
  const gastosPasados = (gastos ?? []).filter(g => !g.fecha || g.fecha <= hoyStr)
  const gastosFuturos = (gastos ?? []).filter(g => g.fecha  &&  g.fecha  > hoyStr)

  /* Contactos */
  const contactoIds = [...new Set((oes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await supabase.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const contactoMap = new Map((contactos ?? []).map(c => [c.id, c.nombre]))

  /* Items — incluye campos de costo para IVA descontable */
  const oeIds = (oes ?? []).map(o => o.id)
  const { data: oeItems } = oeIds.length > 0
    ? await supabase
        .from('oe_items')
        .select('orden_ejecucion_id, proveedor, estado, anticipo_proveedor_pagado, cantidad, costo_unitario, moneda_costo, trm')
        .in('orden_ejecucion_id', oeIds)
    : { data: [] }

  /* ── IVA Colombia: cálculo neto por OE y agrupación por período DIAN ── */
  // Agrupamos items por OE para calcular el IVA descontable de equipos
  const oeItemsMap = new Map<string, Array<{
    cantidad: number; costo_unitario: number | null; moneda_costo: string | null; trm: number | null
  }>>()
  for (const it of oeItems ?? []) {
    const list = oeItemsMap.get(it.orden_ejecucion_id) ?? []
    list.push(it)
    oeItemsMap.set(it.orden_ejecucion_id, list)
  }

  interface IVAOEInfo {
    ivaGenerado:    number
    ivaDescontable: number
    ivaNeto:        number
    periodo:        ReturnType<typeof getPeriodoIVA>
  }
  const ivaByOE     = new Map<string, IVAOEInfo>()
  const ivaByPeriodo = new Map<string, {
    key: string; label: string; mesPago: string; fechaPago: string; total: number
  }>()

  for (const oe of oes ?? []) {
    // IVA generado: 19 % sobre el valor de venta (sin IVA)
    const ivaGenerado = Math.round((oe.total_cotizacion ?? 0) * 0.19)

    // IVA descontable: 19 % sobre el costo de equipos adquiridos a proveedores
    const itemsOE = oeItemsMap.get(oe.id) ?? []
    const costoEquipos = itemsOE.reduce((s, it) => {
      const cu = it.costo_unitario ?? 0
      const qty = it.cantidad ?? 1
      const costoCOP = it.moneda_costo === 'USD'
        ? cu * (it.trm ?? 4000)
        : cu
      return s + qty * costoCOP
    }, 0)
    const ivaDescontable = Math.round(costoEquipos * 0.19)

    // IVA neto a declarar y pagar a DIAN (nunca negativo)
    const ivaNeto  = Math.max(0, ivaGenerado - ivaDescontable)
    const periodo  = getPeriodoIVA(oe.created_at ?? hoyStr, ivaPeriodicidad)

    ivaByOE.set(oe.id, { ivaGenerado, ivaDescontable, ivaNeto, periodo })

    if (ivaNeto > 0) {
      const ex = ivaByPeriodo.get(periodo.key)
      if (ex) { ex.total += ivaNeto }
      else    { ivaByPeriodo.set(periodo.key, { ...periodo, total: ivaNeto }) }
    }
  }

  const totalIVAPendiente = [...ivaByPeriodo.values()].reduce((s, p) => s + p.total, 0)

  /* ── Cálculo automático de caja (transacciones reales registradas) ── */
  const oeIdsSetCalc = new Set((oes ?? []).map(o => o.id))

  // Entradas: anticipos y saldos de clientes ya recibidos (c/IVA)
  const entradasRecibidas = (oes ?? []).reduce((s, o) => {
    const totalIva = o.total_con_iva ?? Math.round((o.total_cotizacion ?? 0) * 1.19)
    const anticIva = Math.round(totalIva * (o.anticipo_porcentaje ?? 50) / 100)
    const saldoIva = Math.max(0, totalIva - anticIva)
    return s
      + (o.anticipo_recibido ? anticIva : 0)
      + (o.saldo_recibido    ? saldoIva : 0)
  }, 0)

  // Salidas: anticipos pagados a proveedores
  const salidasProveedores = (proveedores ?? []).reduce((s, prov) => {
    if (!oeIdsSetCalc.has(prov.orden_ejecucion_id)) return s
    const provItems = (oeItems ?? []).filter(
      i => i.orden_ejecucion_id === prov.orden_ejecucion_id && i.proveedor === prov.proveedor
    )
    const anticipoPagado = provItems.length > 0 && provItems.every(i => i.anticipo_proveedor_pagado)
    return s + (anticipoPagado ? (prov.anticipo_monto ?? 0) : 0)
  }, 0)

  // Salidas: gastos ya realizados
  const salidasGastosRealizados = gastosPasados.reduce((s, g) => s + (g.monto ?? 0), 0)

  const saldoCalculado = Math.round(entradasRecibidas - salidasProveedores - salidasGastosRealizados)

  /* ── Meses del horizonte (actual + 9 siguientes) ── */
  const horizonte = Array.from({ length: 10 }, (_, i) => {
    const d   = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: mesLabel(key), isCurrentMonth: i === 0 }
  })
  const horizonteKeys = new Set(horizonte.map(m => m.key))

  /* ══════════════════════════════════════════════
     VISTA POR PROYECTO
  ══════════════════════════════════════════════ */
  if (vistaActual === 'proyectos') {
    const porProyecto = (oes ?? []).map(oe => {
      const totalIva  = oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19)
      const anticIva  = Math.round(totalIva * (oe.anticipo_porcentaje ?? 50) / 100)
      const saldoIva  = Math.max(0, totalIva - anticIva)
      const cobrado   = (oe.anticipo_recibido ? anticIva : 0) + (oe.saldo_recibido ? saldoIva : 0)
      const porCobrar = Math.max(0, totalIva - cobrado)

      const provs = (proveedores ?? []).filter(p => p.orden_ejecucion_id === oe.id)
      const costoProvTotal = provs.reduce((s, p) => s + Math.round((p.monto_orden ?? 0) * 1.19), 0)

      let provPagado = 0
      for (const p of provs) {
        const items = (oeItems ?? []).filter(
          i => i.orden_ejecucion_id === oe.id && i.proveedor === p.proveedor
        )
        const anticipoPagado = items.length > 0 && items.every(i => i.anticipo_proveedor_pagado)
        const todosBodega    = items.length > 0 && items.every(i => i.estado === 'en_bodega')
        if (anticipoPagado) provPagado += (p.anticipo_monto ?? 0)
        if (todosBodega)    provPagado += Math.max(0, Math.round((p.monto_orden ?? 0) * 1.19) - (p.anticipo_monto ?? 0))
      }

      const porPagarProv = Math.max(0, costoProvTotal - provPagado)

      // IVA neto que debe apartar este proyecto para DIAN
      const ivaOE = ivaByOE.get(oe.id)
      const ivaNeto    = ivaOE?.ivaNeto ?? 0
      const ivaPeriodo = ivaOE?.periodo.label ?? '—'
      const ivaFecha   = ivaOE?.periodo.fechaPago ?? null

      const flujoNeto = porCobrar - porPagarProv - ivaNeto

      return {
        ...oe,
        totalIva, cobrado, porCobrar,
        costoProvTotal, provPagado, porPagarProv,
        ivaNeto, ivaPeriodo, ivaFecha,
        flujoNeto,
        cliente: contactoMap.get(oe.contacto_id ?? '') ?? '—',
      }
    }).sort((a, b) => (b.flujoNeto - a.flujoNeto))

    const totPorCobrar  = porProyecto.reduce((s, r) => s + r.porCobrar,    0)
    const totPorPagar   = porProyecto.reduce((s, r) => s + r.porPagarProv, 0)
    const totIVAOEs     = porProyecto.reduce((s, r) => s + r.ivaNeto,      0)
    const posicionNeta  = totPorCobrar - totPorPagar - totIVAOEs

    return (
      <div>
        <Header vistaActual="proyectos" />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-emerald-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Por cobrar (total)</p>
            <p className="text-2xl font-bold text-emerald-600">${fmt(totPorCobrar)}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Por pagar prov. (total)</p>
            <p className="text-2xl font-bold text-red-600">${fmt(totPorPagar)}</p>
          </div>
          <div className="bg-white rounded-xl border border-violet-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">IVA DIAN (total OEs)</p>
            <p className="text-2xl font-bold text-violet-600">${fmt(totIVAOEs)}</p>
            <p className="text-xs text-gray-400 mt-1">IVA neto a declarar</p>
          </div>
          <div className={`rounded-xl border p-5 ${posicionNeta >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Posición neta</p>
            <p className={`text-2xl font-bold ${posicionNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {posicionNeta >= 0 ? '+' : ''}${fmt(posicionNeta)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Cobros − Prov − IVA DIAN</p>
          </div>
        </div>

        {/* Tabla por proyecto */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Posición de caja por Orden de Ejecución</h2>
            <p className="text-xs text-gray-400 mt-0.5">Valores con IVA incluido · IVA DIAN = IVA generado − IVA descontable de equipos</p>
          </div>
          {porProyecto.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">Sin órdenes de ejecución</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">OE #</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total c/IVA</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-green-600 uppercase">↑ Cobrado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase">Por cobrar</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Costo prov</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-red-500 uppercase">Por pagar</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-violet-600 uppercase">IVA DIAN</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Flujo neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {porProyecto.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/ordenes/${r.id}`}
                        className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                        {r.consecutivo}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{r.cliente}</td>
                    <td className="px-4 py-3 text-right text-gray-700 font-semibold">${fmt(r.totalIva)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-semibold">
                      {r.cobrado > 0 ? `$${fmt(r.cobrado)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {r.porCobrar > 0 ? `$${fmt(r.porCobrar)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {r.costoProvTotal > 0 ? `$${fmt(r.costoProvTotal)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">
                      {r.porPagarProv > 0 ? `$${fmt(r.porPagarProv)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.ivaNeto > 0 ? (
                        <div>
                          <span className="font-semibold text-violet-600">${fmt(r.ivaNeto)}</span>
                          <p className="text-[10px] text-violet-400 whitespace-nowrap">{r.ivaPeriodo}</p>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold text-sm ${
                        r.flujoNeto > 0 ? 'text-emerald-700' : r.flujoNeto < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {r.flujoNeto > 0 ? '+' : ''}{r.flujoNeto !== 0 ? `$${fmt(r.flujoNeto)}` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">
                    Totales ({porProyecto.length} OE{porProyecto.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">
                    ${fmt(porProyecto.reduce((s, r) => s + r.cobrado, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">
                    ${fmt(totPorCobrar)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-500">
                    ${fmt(porProyecto.reduce((s, r) => s + r.costoProvTotal, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">
                    ${fmt(totPorPagar)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-violet-600">
                    ${fmt(totIVAOEs)}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-sm ${
                    posicionNeta >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}>
                    {posicionNeta >= 0 ? '+' : ''}${fmt(posicionNeta)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          Flujo neto = Por cobrar − Por pagar prov − IVA DIAN · IVA neto = IVA generado (19% venta) − IVA descontable (19% costo equipos)
        </p>
      </div>
    )
  }

  /* ══════════════════════════════════════════════
     VISTA GENERAL
  ══════════════════════════════════════════════ */

  /* ── Construir movimientos ── */
  const movimientos: Movimiento[] = []

  /* ENTRADAS: cobros de clientes con fecha (CON IVA) */
  for (const oe of oes ?? []) {
    const cliente  = contactoMap.get(oe.contacto_id ?? '') ?? 'Cliente'
    const totalIva = oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19)
    const anticIva = Math.round(totalIva * (oe.anticipo_porcentaje ?? 50) / 100)
    const saldoIva = Math.max(0, totalIva - anticIva)

    if (!oe.anticipo_recibido && anticIva > 0) {
      const fecha = oe.anticipo_fecha
      const mes   = !fecha ? 'sin_fecha' : fecha < hoyStr ? 'vencido' : toMes(fecha)
      movimientos.push({
        tipo: 'entrada', concepto: `Anticipo — ${oe.consecutivo}`,
        detalle: cliente, monto: anticIva, fecha, mes, oeId: oe.id,
      })
    }

    if (oe.anticipo_recibido && !oe.saldo_recibido && saldoIva > 0) {
      const fecha = oe.saldo_fecha
      const mes   = !fecha ? 'sin_fecha' : fecha < hoyStr ? 'vencido' : toMes(fecha)
      movimientos.push({
        tipo: 'entrada', concepto: `Saldo — ${oe.consecutivo}`,
        detalle: cliente, monto: saldoIva, fecha, mes, oeId: oe.id,
      })
    }
  }

  /* SALIDAS: pagos a proveedores — mes estimado según estado del pago */
  const oeIdsSet = new Set((oes ?? []).map(o => o.id))
  const oeMap    = new Map((oes ?? []).map(o => [o.id, o]))

  for (const prov of proveedores ?? []) {
    if (!oeIdsSet.has(prov.orden_ejecucion_id)) continue
    const provItems = (oeItems ?? []).filter(
      i => i.orden_ejecucion_id === prov.orden_ejecucion_id && i.proveedor === prov.proveedor
    )
    const anticipoPagado = provItems.length > 0 && provItems.every(i => i.anticipo_proveedor_pagado)
    const todosBodega    = provItems.length > 0 && provItems.every(i => i.estado === 'en_bodega')
    const oe             = oeMap.get(prov.orden_ejecucion_id)

    if (!anticipoPagado && (prov.anticipo_monto ?? 0) > 0) {
      movimientos.push({
        tipo: 'salida', concepto: `Anticipo prov. — ${prov.proveedor}`,
        detalle: 'Estimado mes actual', monto: prov.anticipo_monto ?? 0,
        fecha: null, mes: mesHoy, oeId: prov.orden_ejecucion_id,
      })
    }

    if (anticipoPagado && !todosBodega) {
      const saldo = Math.max(0, Math.round((prov.monto_orden ?? 0) * 1.19) - (prov.anticipo_monto ?? 0))
      if (saldo > 0) {
        const saldoFechaOE = oe?.saldo_fecha
        const mesPago = saldoFechaOE && horizonteKeys.has(toMes(saldoFechaOE))
          ? toMes(saldoFechaOE)
          : mesHoy
        movimientos.push({
          tipo: 'salida', concepto: `Saldo prov. — ${prov.proveedor}`,
          detalle: saldoFechaOE ? 'Al cobrar saldo del cliente' : 'Estimado mes actual',
          monto: saldo, fecha: null, mes: mesPago, oeId: prov.orden_ejecucion_id,
        })
      }
    }
  }

  /* SALIDAS: gastos puntuales futuros */
  for (const g of gastosFuturos) {
    const mes = !g.fecha ? 'sin_fecha' : toMes(g.fecha)
    movimientos.push({
      tipo: 'salida', concepto: `Gasto — ${g.descripcion}`,
      detalle: g.categoria ?? 'otros', monto: g.monto ?? 0,
      fecha: g.fecha, mes,
    })
  }

  /* SALIDAS: gastos fijos → un movimiento por mes en el horizonte */
  for (const mes of horizonte) {
    for (const gf of gastosFijos ?? []) {
      movimientos.push({
        tipo: 'salida', concepto: gf.nombre,
        detalle: gf.categoria,
        monto: gf.monto, fecha: null,
        mes: mes.key, esGastoFijo: true,
      })
    }
  }

  /* SALIDAS: IVA DIAN — asignado al mes de vencimiento del período */
  for (const [, pd] of ivaByPeriodo) {
    const mes = pd.mesPago < mesHoy
      ? 'vencido'
      : horizonteKeys.has(pd.mesPago)
      ? pd.mesPago
      : 'sin_fecha'
    movimientos.push({
      tipo: 'salida',
      concepto: `IVA DIAN — ${pd.label}`,
      detalle: `Período ${ivaPeriodicidad} · Vence ~${new Date(pd.fechaPago + 'T12:00:00').toLocaleDateString('es-CO')}`,
      monto: pd.total,
      fecha: pd.fechaPago,
      mes,
      esIVA: true,
    })
  }

  /* ── Agrupar por mes ── */
  const ORDEN_FIJO = [
    'vencido',
    ...horizonte.map(m => m.key),
    'sin_fecha',
  ]

  const mesesConMovs = new Set(movimientos.map(m => m.mes))
  const mesesOrden   = ORDEN_FIJO.filter(m => mesesConMovs.has(m))
  for (const m of mesesConMovs) {
    if (!ORDEN_FIJO.includes(m)) mesesOrden.push(m)
  }

  const grupos = mesesOrden.map(mes => {
    const movs            = movimientos.filter(m => m.mes === mes)
    const entradas        = movs.filter(m => m.tipo === 'entrada')
    const salidas         = movs.filter(m => m.tipo === 'salida')
    const gastosFijosMovs = salidas.filter(m =>  m.esGastoFijo)
    const ivaMovs         = salidas.filter(m =>  m.esIVA)
    const otrasMovs       = salidas.filter(m => !m.esGastoFijo && !m.esIVA)
    const totEnt          = entradas.reduce((s, m) => s + m.monto, 0)
    const totSal          = salidas.reduce((s, m)  => s + m.monto, 0)
    const totGF           = gastosFijosMovs.reduce((s, m) => s + m.monto, 0)
    const totIVA          = ivaMovs.reduce((s, m) => s + m.monto, 0)
    return {
      mes, entradas, salidas: otrasMovs, gastosFijosMovs, ivaMovs,
      totEnt, totSal, totGF, totIVA, balance: totEnt - totSal,
    }
  })

  /* Balance acumulado — arranca desde saldo en caja actual */
  let acum = saldoCajaActual !== 0 ? saldoCajaActual : saldoCalculado
  const gruposConAcum = grupos.map(g => {
    if (g.mes === 'sin_fecha') return { ...g, saldoInicio: acum, saldoFin: acum }
    const saldoInicio = acum
    acum += g.balance
    return { ...g, saldoInicio, saldoFin: acum }
  })

  /* ── Proyección mensual ── */
  const cobrosPorMes = new Map<string, number>()
  for (const oe of oes ?? []) {
    const totalIva = oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19)
    const anticIva = Math.round(totalIva * (oe.anticipo_porcentaje ?? 50) / 100)
    const saldoIva = Math.max(0, totalIva - anticIva)
    if (!oe.anticipo_recibido && anticIva > 0 && oe.anticipo_fecha) {
      const mes = toMes(oe.anticipo_fecha)
      if (horizonteKeys.has(mes)) cobrosPorMes.set(mes, (cobrosPorMes.get(mes) ?? 0) + anticIva)
    }
    if (oe.anticipo_recibido && !oe.saldo_recibido && saldoIva > 0 && oe.saldo_fecha) {
      const mes = toMes(oe.saldo_fecha)
      if (horizonteKeys.has(mes)) cobrosPorMes.set(mes, (cobrosPorMes.get(mes) ?? 0) + saldoIva)
    }
  }

  /* Pagos a proveedor por mes */
  const pagosProvPorMes = new Map<string, number>()
  for (const prov of proveedores ?? []) {
    if (!oeIdsSet.has(prov.orden_ejecucion_id)) continue
    const provItems = (oeItems ?? []).filter(
      i => i.orden_ejecucion_id === prov.orden_ejecucion_id && i.proveedor === prov.proveedor
    )
    const anticipoPagado = provItems.length > 0 && provItems.every(i => i.anticipo_proveedor_pagado)
    const todosBodega    = provItems.length > 0 && provItems.every(i => i.estado === 'en_bodega')
    const oe             = oeMap.get(prov.orden_ejecucion_id)

    if (!anticipoPagado && (prov.anticipo_monto ?? 0) > 0) {
      pagosProvPorMes.set(mesHoy, (pagosProvPorMes.get(mesHoy) ?? 0) + (prov.anticipo_monto ?? 0))
    }
    if (anticipoPagado && !todosBodega) {
      const saldo = Math.max(0, Math.round((prov.monto_orden ?? 0) * 1.19) - (prov.anticipo_monto ?? 0))
      if (saldo > 0) {
        const saldoFechaOE = oe?.saldo_fecha
        const mesPago = saldoFechaOE && horizonteKeys.has(toMes(saldoFechaOE))
          ? toMes(saldoFechaOE)
          : mesHoy
        pagosProvPorMes.set(mesPago, (pagosProvPorMes.get(mesPago) ?? 0) + saldo)
      }
    }
  }

  /* IVA DIAN por mes (para proyección) */
  const ivaProyeccionPorMes = new Map<string, number>()
  for (const [, pd] of ivaByPeriodo) {
    if (horizonteKeys.has(pd.mesPago)) {
      ivaProyeccionPorMes.set(pd.mesPago, (ivaProyeccionPorMes.get(pd.mesPago) ?? 0) + pd.total)
    }
  }

  const saldoBaseProyeccion = saldoCajaActual !== 0 ? saldoCajaActual : saldoCalculado
  let saldoRol = saldoBaseProyeccion
  const proyeccion = horizonte.map(m => {
    const cobros    = cobrosPorMes.get(m.key) ?? 0
    const pagosProv = pagosProvPorMes.get(m.key) ?? 0
    const ivaDIAN   = ivaProyeccionPorMes.get(m.key) ?? 0
    const gastos    = totalGastosFijos
    const saldoInicio = saldoRol
    const saldoFin  = saldoInicio + cobros - pagosProv - ivaDIAN - gastos
    saldoRol = saldoFin
    return { ...m, cobros, pagosProv, ivaDIAN, gastos, saldoInicio, saldoFin, neto: cobros - pagosProv - ivaDIAN - gastos }
  })

  /* KPIs globales */
  const totEntradasGlobal = movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0)
  const vencidos          = movimientos.filter(m => m.mes === 'vencido')
  const totVencido        = vencidos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0)
  const totObligacionesProv = [...pagosProvPorMes.values()].reduce((s, v) => s + v, 0)

  /* Próximo vencimiento IVA */
  const ivaPeriodsArr = [...ivaByPeriodo.values()].sort((a, b) => a.mesPago.localeCompare(b.mesPago))
  const proximoIVA    = ivaPeriodsArr[0] ?? null

  return (
    <div>
      <Header vistaActual="general" />

      {/* Banner superior: caja + gastos fijos + IVA DIAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Saldo en caja */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">💰 Saldo actual en caja</p>
              <p className="text-xs text-emerald-600 mt-0.5">Ingresa el dinero disponible hoy</p>
            </div>
          </div>
          <SaldoCajaEditor
            saldoActual={saldoCajaActual}
            saldoCalculado={saldoCalculado}
            detalleCaja={{
              entradas:      entradasRecibidas,
              salidasProv:   salidasProveedores,
              salidasGastos: salidasGastosRealizados,
            }}
          />
          <p className="text-xs text-emerald-600 mt-2">
            La proyección mensual parte de este valor y suma cobros / descuenta gastos fijos.
          </p>
        </div>

        {/* Gastos fijos */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">📅 Gastos fijos mensuales</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {(gastosFijos ?? []).length} gasto{(gastosFijos ?? []).length !== 1 ? 's' : ''} activo{(gastosFijos ?? []).length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/admin/finanzas/gastos-fijos"
              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors font-semibold"
            >
              ⚙️ Gestionar
            </Link>
          </div>
          <p className="text-2xl font-bold text-amber-800">
            ${fmt(totalGastosFijos)}<span className="text-sm font-normal text-amber-600">/mes</span>
          </p>
          {(gastosFijos ?? []).length > 0 && (
            <p className="text-xs text-amber-600 mt-2 truncate">
              {(gastosFijos ?? []).slice(0, 4).map(g => g.nombre).join(' · ')}
              {(gastosFijos ?? []).length > 4 && ` · +${(gastosFijos ?? []).length - 4} más`}
            </p>
          )}
        </div>

        {/* IVA DIAN */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">🏛️ IVA DIAN pendiente</p>
              <p className="text-xs text-violet-600 mt-0.5 capitalize">Régimen: {ivaPeriodicidad}</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-violet-800">${fmt(totalIVAPendiente)}</p>
          <div className="mt-2 space-y-1">
            {ivaPeriodsArr.length === 0 ? (
              <p className="text-xs text-violet-400">Sin OEs con IVA calculado</p>
            ) : (
              ivaPeriodsArr.map(pd => (
                <div key={pd.key} className="text-xs text-violet-600 flex justify-between">
                  <span>{pd.label}</span>
                  <span className="font-semibold">${fmt(pd.total)} · vence {new Date(pd.fechaPago + 'T12:00:00').toLocaleDateString('es-CO')}</span>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-violet-400 mt-2">IVA generado − IVA descontable de equipos</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Entradas esperadas</p>
          <p className="text-2xl font-bold text-emerald-600">${fmt(totEntradasGlobal)}</p>
          <p className="text-xs text-gray-400 mt-1">Cobros pendientes clientes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Gastos fijos (10 meses)</p>
          <p className="text-2xl font-bold text-amber-600">${fmt(totalGastosFijos * 10)}</p>
          <p className="text-xs text-gray-400 mt-1">${fmt(totalGastosFijos)}/mes × horizonte</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Obligaciones prov.</p>
          <p className="text-2xl font-bold text-red-600">${fmt(totObligacionesProv)}</p>
          <p className="text-xs text-gray-400 mt-1">Pagos pendientes a proveedores</p>
        </div>
        <div className={`rounded-xl border p-5 ${totVencido > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">⚠ Cobros vencidos</p>
          <p className={`text-2xl font-bold ${totVencido > 0 ? 'text-red-700' : 'text-gray-400'}`}>
            {totVencido > 0 ? `$${fmt(totVencido)}` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Fecha comprometida ya pasó</p>
        </div>
      </div>

      {/* Proyección mensual — cards horizontales */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Proyección de caja — mes a mes</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Arranca desde caja actual · descuenta gastos fijos + IVA DIAN + pagos prov. · suma cobros con fecha
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {proyeccion.map((m, idx) => {
              const saldoOk  = m.saldoFin >= 0
              const esActual = m.isCurrentMonth
              const barH     = Math.min(100, Math.abs(m.saldoFin) / Math.max(...proyeccion.map(p => Math.abs(p.saldoFin)), 1) * 80)
              return (
                <div
                  key={m.key}
                  className={`flex flex-col p-4 border-r border-gray-100 min-w-[170px] ${
                    esActual ? 'bg-blue-50' : 'bg-white'
                  } ${idx === proyeccion.length - 1 ? 'border-r-0' : ''}`}
                >
                  <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${esActual ? 'text-blue-600' : 'text-gray-400'}`}>
                    {esActual ? '📅 ' : ''}{m.label}
                  </p>

                  <div className="space-y-1.5 text-xs flex-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Inicio</span>
                      <span className="font-semibold">${fmt(m.saldoInicio)}</span>
                    </div>
                    {m.cobros > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>↑ Cobros</span>
                        <span className="font-semibold">+${fmt(m.cobros)}</span>
                      </div>
                    )}
                    {m.pagosProv > 0 && (
                      <div className="flex justify-between text-red-500">
                        <span>↓ Prov.</span>
                        <span className="font-semibold">−${fmt(m.pagosProv)}</span>
                      </div>
                    )}
                    {m.ivaDIAN > 0 && (
                      <div className="flex justify-between text-violet-600">
                        <span>↓ IVA DIAN</span>
                        <span className="font-semibold">−${fmt(m.ivaDIAN)}</span>
                      </div>
                    )}
                    {m.gastos > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>↓ G.Fijos</span>
                        <span className="font-semibold">−${fmt(m.gastos)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-1.5 mt-1.5" />
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-600">Saldo</span>
                      <span className={saldoOk ? 'text-emerald-700' : 'text-red-600'}>
                        ${fmt(m.saldoFin)}
                      </span>
                    </div>
                  </div>

                  {/* Barra visual */}
                  <div className="mt-3 flex items-end justify-center h-8">
                    <div
                      className={`w-full rounded-sm transition-all ${saldoOk ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ height: `${Math.max(4, barH)}%`, minHeight: '4px' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Timeline detallado */}
      {gruposConAcum.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <p className="text-lg mb-1">Sin movimientos proyectados</p>
          <p className="text-sm">Agrega fechas de anticipo y saldo en las órdenes de ejecución.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gruposConAcum.map(g => {
            const isVencido  = g.mes === 'vencido'
            const isSinFecha = g.mes === 'sin_fecha'
            const esHoy      = g.mes === mesHoy

            const headerCls = isVencido
              ? 'bg-red-50 border-red-200'
              : isSinFecha
              ? 'bg-gray-50 border-gray-200'
              : esHoy
              ? 'bg-blue-50 border-blue-200'
              : 'bg-white border-gray-200'

            const titulo = isVencido
              ? '⚠ Pagos vencidos'
              : isSinFecha
              ? '📋 Sin fecha asignada (proveedores pendientes)'
              : esHoy
              ? `📅 ${mesLabel(g.mes)} (mes actual)`
              : mesLabel(g.mes)

            const totalMovsCount =
              g.entradas.length + g.salidas.length + g.gastosFijosMovs.length + g.ivaMovs.length

            return (
              <details
                key={g.mes}
                className="rounded-xl border overflow-hidden group"
                open={esHoy || isVencido}
              >
                {/* Header mes — summary colapsable */}
                <summary className={`px-5 py-3.5 border-b border-inherit flex flex-wrap items-center justify-between gap-3 cursor-pointer list-none select-none ${headerCls}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-400 text-xs font-bold transition-transform group-open:rotate-90 shrink-0">▶</span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm">{titulo}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {g.entradas.length} cobro{g.entradas.length !== 1 ? 's' : ''} ·{' '}
                        {g.salidas.length} pago{g.salidas.length !== 1 ? 's' : ''} prov.
                        {g.gastosFijosMovs.length > 0 && ` · ${g.gastosFijosMovs.length} gasto${g.gastosFijosMovs.length !== 1 ? 's' : ''} fijo${g.gastosFijosMovs.length !== 1 ? 's' : ''}`}
                        {g.ivaMovs.length > 0 && ` · IVA DIAN`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Entradas</p>
                      <p className="font-bold text-emerald-600">+${fmt(g.totEnt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Salidas</p>
                      <p className="font-bold text-red-600">−${fmt(g.totSal)}</p>
                    </div>
                    {g.totIVA > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">IVA DIAN</p>
                        <p className="font-bold text-violet-600">−${fmt(g.totIVA)}</p>
                      </div>
                    )}
                    <div className="text-right border-l border-gray-200 pl-4">
                      <p className="text-xs text-gray-400">Neto mes</p>
                      <p className={`font-bold ${g.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {g.balance >= 0 ? '+' : ''}{fmt(g.balance)}
                      </p>
                    </div>
                    {!isSinFecha && (
                      <div className="text-right border-l border-gray-200 pl-4">
                        <p className="text-xs text-gray-400">Saldo proyectado</p>
                        <p className={`font-bold text-sm ${g.saldoFin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          ${fmt(g.saldoFin)}
                        </p>
                      </div>
                    )}
                  </div>
                </summary>

                {/* Movimientos */}
                <div className="bg-white divide-y divide-gray-50">
                  {/* Entradas OE */}
                  {g.entradas.map((m, i) => (
                    <div key={`e-${i}`} className="flex items-center px-5 py-2.5 hover:bg-emerald-50/30 transition-colors">
                      <span className="text-emerald-500 text-xs font-bold w-5">↑</span>
                      <div className="flex-1 min-w-0 ml-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.concepto}</p>
                        <p className="text-xs text-gray-400">{m.detalle}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        {m.fecha && (
                          <span className={`text-xs ${isVencido ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                            {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-CO')}
                          </span>
                        )}
                        {m.oeId && (
                          <Link href={`/admin/ordenes/${m.oeId}`} className="text-xs text-blue-400 hover:underline">Ver OE</Link>
                        )}
                        <span className="font-bold text-emerald-600 text-sm w-36 text-right">+${fmt(m.monto)}</span>
                      </div>
                    </div>
                  ))}

                  {/* Salidas OE / gastos puntuales */}
                  {g.salidas.map((m, i) => (
                    <div key={`s-${i}`} className="flex items-center px-5 py-2.5 hover:bg-red-50/30 transition-colors">
                      <span className="text-red-400 text-xs font-bold w-5">↓</span>
                      <div className="flex-1 min-w-0 ml-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.concepto}</p>
                        <p className="text-xs text-gray-400">{m.detalle}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        {m.fecha && (
                          <span className="text-xs text-gray-400">
                            {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-CO')}
                          </span>
                        )}
                        {m.oeId && (
                          <Link href={`/admin/ordenes/${m.oeId}`} className="text-xs text-blue-400 hover:underline">Ver OE</Link>
                        )}
                        <span className="font-bold text-red-500 text-sm w-36 text-right">−${fmt(m.monto)}</span>
                      </div>
                    </div>
                  ))}

                  {/* Gastos fijos — bloque separado visualmente */}
                  {g.gastosFijosMovs.length > 0 && (
                    <div className="bg-amber-50/40 border-t border-amber-100">
                      <div className="px-5 py-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                          Gastos fijos recurrentes
                        </span>
                        <span className="text-xs font-bold text-amber-700">−${fmt(g.totGF)}</span>
                      </div>
                      {g.gastosFijosMovs.map((m, i) => (
                        <div key={`gf-${i}`} className="flex items-center px-5 py-2 hover:bg-amber-50/60 transition-colors">
                          <span className="text-amber-500 text-xs font-bold w-5">↓</span>
                          <div className="flex-1 min-w-0 ml-2">
                            <p className="text-sm font-medium text-gray-700 truncate">{m.concepto}</p>
                            <p className="text-xs text-amber-600 capitalize">{m.detalle}</p>
                          </div>
                          <span className="font-semibold text-amber-600 text-sm w-36 text-right">−${fmt(m.monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* IVA DIAN — bloque separado */}
                  {g.ivaMovs.length > 0 && (
                    <div className="bg-violet-50/40 border-t border-violet-100">
                      <div className="px-5 py-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
                          🏛️ IVA DIAN por declarar
                        </span>
                        <span className="text-xs font-bold text-violet-700">−${fmt(g.totIVA)}</span>
                      </div>
                      {g.ivaMovs.map((m, i) => (
                        <div key={`iva-${i}`} className="flex items-center px-5 py-2 hover:bg-violet-50/60 transition-colors">
                          <span className="text-violet-500 text-xs font-bold w-5">↓</span>
                          <div className="flex-1 min-w-0 ml-2">
                            <p className="text-sm font-medium text-gray-700 truncate">{m.concepto}</p>
                            <p className="text-xs text-violet-500">{m.detalle}</p>
                          </div>
                          {m.fecha && (
                            <span className="text-xs text-gray-400 mr-4">
                              Vence: {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-CO')}
                            </span>
                          )}
                          <span className="font-semibold text-violet-600 text-sm w-36 text-right">−${fmt(m.monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400 text-center">
        Saldo proyectado parte de caja actual · descuenta pagos a prov., IVA DIAN y gastos fijos · suma cobros con fecha. <br />
        IVA neto = IVA generado (19% sobre venta) − IVA descontable (19% sobre costo equipos adquiridos). Vencimientos aprox. según DIAN.
      </p>
    </div>
  )
}

/* ── Componente Header compartido ── */
function Header({ vistaActual }: { vistaActual: 'general' | 'proyectos' }) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/finanzas" className="text-gray-400 hover:text-gray-600 text-sm">← Finanzas</Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Flujo de caja</h1>
        <p className="text-sm text-gray-500 mt-1">
          {vistaActual === 'general'
            ? 'Proyección real: saldo actual + cobros − gastos fijos − IVA DIAN − pagos proveedores'
            : 'Posición de caja por Orden de Ejecución · incluye IVA neto a declarar a DIAN'}
        </p>
      </div>
      {/* Tabs de vista */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
        <Link
          href="/admin/finanzas/flujo?vista=general"
          className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
            vistaActual === 'general'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🔄 Vista general
        </Link>
        <Link
          href="/admin/finanzas/flujo?vista=proyectos"
          className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
            vistaActual === 'proyectos'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📦 Por proyecto
        </Link>
      </div>
    </div>
  )
}
