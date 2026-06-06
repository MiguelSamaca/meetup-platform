import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile }  from '@/lib/auth'
import Link                   from 'next/link'

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function mesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const fecha  = new Date(Number(y), Number(m) - 1, 1)
  return fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function toMes(fecha: string | null): string {
  if (!fecha) return 'sin_fecha'
  return fecha.slice(0, 7) // 'YYYY-MM'
}

/* ── Tipos internos ── */
interface Movimiento {
  tipo:        'entrada' | 'salida'
  concepto:    string
  detalle:     string
  monto:       number
  fecha:       string | null
  mes:         string           // 'YYYY-MM' | 'vencido' | 'sin_fecha'
  oeId?:       string
  proyectoId?: string
}

/* ── Page ── */
export default async function FlujoCajaPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const tid      = profile?.tenant_id!
  const hoy      = new Date()
  const hoyStr   = hoy.toISOString().split('T')[0]
  const mesHoy   = hoyStr.slice(0, 7)

  /* ── Datos ── */
  const [
    { data: oes },
    { data: proveedores },
    { data: gastos },
  ] = await Promise.all([
    supabase
      .from('ordenes_ejecucion')
      .select(`
        id, consecutivo, total_cotizacion, total_con_iva,
        anticipo_porcentaje, anticipo_monto, anticipo_fecha, anticipo_recibido,
        saldo_fecha, saldo_recibido, contacto_id
      `)
      .eq('tenant_id', tid),
    supabase
      .from('oe_proveedores')
      .select('orden_ejecucion_id, proveedor, monto_orden, anticipo_monto'),
    supabase
      .from('gastos')
      .select('id, proyecto_id, descripcion, monto, categoria, fecha')
      .eq('tenant_id', tid)
      .gte('fecha', hoyStr)   // Solo gastos futuros o de hoy
      .order('fecha'),
  ])

  /* Contactos para OEs */
  const contactoIds = [...new Set((oes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await supabase.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const contactoMap = new Map((contactos ?? []).map(c => [c.id, c.nombre]))

  /* OEs del tenant para filtrar proveedores */
  const oeIds = new Set((oes ?? []).map(o => o.id))

  /* Items para estado de anticipo proveedor */
  const { data: oeItems } = await supabase
    .from('oe_items')
    .select('orden_ejecucion_id, proveedor, estado, anticipo_proveedor_pagado')

  /* ── Construir movimientos ── */
  const movimientos: Movimiento[] = []

  /* ENTRADAS: anticipos y saldos de clientes — valores CON IVA (cash real) */
  for (const oe of oes ?? []) {
    const cliente  = contactoMap.get(oe.contacto_id ?? '') ?? 'Cliente'
    const totalIva = oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19)
    const anticIva = Math.round(totalIva * (oe.anticipo_porcentaje ?? 50) / 100)
    const saldoIva = Math.max(0, totalIva - anticIva)

    // Anticipo pendiente
    if (!oe.anticipo_recibido && anticIva > 0) {
      const fecha = oe.anticipo_fecha
      const mes   = !fecha ? 'sin_fecha' : fecha < hoyStr ? 'vencido' : toMes(fecha)
      movimientos.push({
        tipo:    'entrada',
        concepto: `Anticipo — ${oe.consecutivo}`,
        detalle:  cliente,
        monto:   anticIva,
        fecha,
        mes,
        oeId:    oe.id,
      })
    }

    // Saldo pendiente (solo si anticipo ya se recibió)
    if (oe.anticipo_recibido && !oe.saldo_recibido && saldoIva > 0) {
      const fecha = oe.saldo_fecha
      const mes   = !fecha ? 'sin_fecha' : fecha < hoyStr ? 'vencido' : toMes(fecha)
      movimientos.push({
        tipo:    'entrada',
        concepto: `Saldo — ${oe.consecutivo}`,
        detalle:  cliente,
        monto:   saldoIva,
        fecha,
        mes,
        oeId:    oe.id,
      })
    }
  }

  /* SALIDAS: anticipos a proveedores pendientes */
  for (const prov of proveedores ?? []) {
    if (!oeIds.has(prov.orden_ejecucion_id)) continue
    const provItems = (oeItems ?? []).filter(
      i => i.orden_ejecucion_id === prov.orden_ejecucion_id && i.proveedor === prov.proveedor
    )
    const anticipoPagado = provItems.length > 0 && provItems.every(i => i.anticipo_proveedor_pagado)
    const todosBodega    = provItems.length > 0 && provItems.every(i => i.estado === 'en_bodega')

    // Anticipo proveedor pendiente — monto YA incluye IVA (fue calculado sobre total c/IVA)
    if (!anticipoPagado && (prov.anticipo_monto ?? 0) > 0) {
      movimientos.push({
        tipo:    'salida',
        concepto: `Anticipo prov. — ${prov.proveedor}`,
        detalle:  'Sin fecha asignada',
        monto:   prov.anticipo_monto ?? 0,   // ya es c/IVA desde el fix del panel
        fecha:   null,
        mes:     'sin_fecha',
        oeId:    prov.orden_ejecucion_id,
      })
    }

    // Saldo proveedor pendiente — calcular sobre monto_orden * 1.19
    if (anticipoPagado && !todosBodega) {
      const montoIva = Math.round((prov.monto_orden ?? 0) * 1.19)
      const saldo    = Math.max(0, montoIva - (prov.anticipo_monto ?? 0))
      if (saldo > 0) {
        movimientos.push({
          tipo:    'salida',
          concepto: `Saldo prov. — ${prov.proveedor}`,
          detalle:  'Sin fecha asignada',
          monto:   saldo,
          fecha:   null,
          mes:     'sin_fecha',
          oeId:    prov.orden_ejecucion_id,
        })
      }
    }
  }

  /* SALIDAS: gastos futuros */
  for (const g of gastos ?? []) {
    const fecha = g.fecha
    const mes   = !fecha ? 'sin_fecha' : toMes(fecha)
    movimientos.push({
      tipo:       'salida',
      concepto:   `Gasto — ${g.descripcion}`,
      detalle:    g.categoria ?? 'otros',
      monto:      g.monto ?? 0,
      fecha,
      mes,
      proyectoId: g.proyecto_id,
    })
  }

  /* ── Agrupar por mes ── */
  const ORDEN_FIJO = ['vencido', ...Array.from({ length: 9 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }), 'sin_fecha']

  const mesesConMovs = new Set(movimientos.map(m => m.mes))
  const mesesOrden   = ORDEN_FIJO.filter(m => mesesConMovs.has(m))
  // Agregar meses con movimientos que no estén en el orden fijo
  for (const m of mesesConMovs) {
    if (!ORDEN_FIJO.includes(m)) mesesOrden.push(m)
  }

  const grupos = mesesOrden.map(mes => {
    const movs     = movimientos.filter(m => m.mes === mes)
    const entradas = movs.filter(m => m.tipo === 'entrada')
    const salidas  = movs.filter(m => m.tipo === 'salida')
    const totEnt   = entradas.reduce((s, m) => s + m.monto, 0)
    const totSal   = salidas.reduce((s, m)  => s + m.monto, 0)
    return { mes, movs, entradas, salidas, totEnt, totSal, balance: totEnt - totSal }
  })

  /* Balance acumulado */
  let acum = 0
  const gruposConAcum = grupos.map(g => {
    acum += g.balance
    return { ...g, acum }
  })

  /* KPIs globales */
  const totEntradasGlobal = movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0)
  const totSalidasGlobal  = movimientos.filter(m => m.tipo === 'salida' ).reduce((s, m) => s + m.monto, 0)
  const balanceNeto       = totEntradasGlobal - totSalidasGlobal
  const vencidos          = movimientos.filter(m => m.mes === 'vencido')
  const totVencido        = vencidos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/finanzas" className="text-gray-400 hover:text-gray-600 text-sm">← Finanzas</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Flujo de caja proyectado</h1>
          <p className="text-sm text-gray-500 mt-1">
            Entradas esperadas vs. salidas pendientes — desde hoy hacia adelante
          </p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>Hoy: {hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Entradas esperadas</p>
          <p className="text-2xl font-bold text-emerald-600">${fmt(totEntradasGlobal)}</p>
          <p className="text-xs text-gray-400 mt-1">Cobros pendientes de clientes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Salidas pendientes</p>
          <p className="text-2xl font-bold text-red-600">${fmt(totSalidasGlobal)}</p>
          <p className="text-xs text-gray-400 mt-1">Pagos a proveedores y gastos</p>
        </div>
        <div className={`rounded-xl border p-5 ${balanceNeto >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Balance neto proyectado</p>
          <p className={`text-2xl font-bold ${balanceNeto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {balanceNeto >= 0 ? '+' : ''}{fmt(balanceNeto)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Entradas − Salidas</p>
        </div>
        <div className={`rounded-xl border p-5 ${totVencido > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">⚠ Cobros vencidos</p>
          <p className={`text-2xl font-bold ${totVencido > 0 ? 'text-red-700' : 'text-gray-400'}`}>
            {totVencido > 0 ? `$${fmt(totVencido)}` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Fecha comprometida ya pasó</p>
        </div>
      </div>

      {/* Timeline por mes */}
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
              ? '📋 Sin fecha asignada'
              : esHoy
              ? `📅 ${mesLabel(g.mes)} (mes actual)`
              : mesLabel(g.mes)

            return (
              <div key={g.mes} className={`rounded-xl border overflow-hidden`}>
                {/* Header del mes */}
                <div className={`px-5 py-3.5 border-b border-inherit flex items-center justify-between ${headerCls}`}>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{titulo}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {g.entradas.length} entrada{g.entradas.length !== 1 ? 's' : ''} ·{' '}
                      {g.salidas.length} salida{g.salidas.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Entradas</p>
                      <p className="font-bold text-emerald-600">+${fmt(g.totEnt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Salidas</p>
                      <p className="font-bold text-red-600">−${fmt(g.totSal)}</p>
                    </div>
                    <div className="text-right border-l border-gray-200 pl-6">
                      <p className="text-xs text-gray-400">Balance mes</p>
                      <p className={`font-bold ${g.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {g.balance >= 0 ? '+' : ''}{fmt(g.balance)}
                      </p>
                    </div>
                    {!isSinFecha && (
                      <div className="text-right border-l border-gray-200 pl-6">
                        <p className="text-xs text-gray-400">Balance acum.</p>
                        <p className={`font-bold text-sm ${g.acum >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {g.acum >= 0 ? '+' : ''}{fmt(g.acum)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Movimientos del mes */}
                <div className="bg-white divide-y divide-gray-50">
                  {/* Entradas */}
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
                          <Link href={`/admin/ordenes/${m.oeId}`} className="text-xs text-blue-400 hover:underline">
                            Ver OE
                          </Link>
                        )}
                        <span className="font-bold text-emerald-600 text-sm w-32 text-right">
                          +${fmt(m.monto)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Salidas */}
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
                          <Link href={`/admin/ordenes/${m.oeId}`} className="text-xs text-blue-400 hover:underline">
                            Ver OE
                          </Link>
                        )}
                        {m.proyectoId && (
                          <Link href={`/admin/proyectos/${m.proyectoId}`} className="text-xs text-blue-400 hover:underline">
                            Ver proyecto
                          </Link>
                        )}
                        <span className="font-bold text-red-500 text-sm w-32 text-right">
                          −${fmt(m.monto)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nota al pie */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Las entradas sin fecha de pago configurada aparecen en "Sin fecha asignada". <br />
        Para asignar fechas de anticipo y saldo, éditalas directamente en la{' '}
        <Link href="/admin/ordenes" className="text-emerald-600 hover:underline">Orden de Ejecución</Link>.
      </p>
    </div>
  )
}
