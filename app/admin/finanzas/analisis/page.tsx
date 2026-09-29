import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile }  from '@/lib/auth'
import { redirect }           from 'next/navigation'
import Link                   from 'next/link'
import { fmt } from '@/lib/format'

export const metadata = { title: 'Análisis de ventas | Finanzas' }

const GASTOS_OP = ['operacional', 'administrativo', 'financiero']
const CLASE_LABEL: Record<string, string> = {
  operacional: 'Operacional', administrativo: 'Administrativo', financiero: 'Financiero',
}

function mesLabel(mes: string) {
  return new Date(mes + '-01T12:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}
function shiftMes(mes: string, delta: number) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) redirect('/login')
  if (profile.rol !== 'admin') redirect('/admin')

  const admin = createAdminClient()
  const tid   = profile.tenant_id

  const sp    = await searchParams
  const hoy   = new Date()
  const mes   = /^\d{4}-\d{2}$/.test(sp.mes ?? '')
    ? sp.mes!
    : `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const inicio     = `${mes}-01`
  const inicioNext = `${shiftMes(mes, 1)}-01`

  // Órdenes generadas en el mes (ventas)
  const { data: oes } = await admin
    .from('ordenes_ejecucion')
    .select('id, consecutivo, total_cotizacion, tipo_venta, contacto_id, created_at')
    .eq('tenant_id', tid)
    .gte('created_at', inicio).lt('created_at', inicioNext)
    .order('created_at', { ascending: false })

  const oeIds = (oes ?? []).map(o => o.id)

  // Ítems de esas órdenes (costos)
  const { data: items } = oeIds.length > 0
    ? await admin.from('oe_items')
        .select('id, orden_ejecucion_id, descripcion, referencia, cantidad, costo_unitario, moneda_costo, trm, orden')
        .in('orden_ejecucion_id', oeIds)
    : { data: [] }

  // Movimientos del mes (gastos operativos)
  const { data: movs } = await admin
    .from('movimientos')
    .select('id, tipo, monto, concepto, clasificacion, categoria_id, fecha')
    .eq('tenant_id', tid)
    .gte('fecha', inicio).lt('fecha', inicioNext)

  // Nombres de categorías
  const { data: cats } = await admin
    .from('movimiento_categorias').select('id, nombre').eq('tenant_id', tid)
  const catNombre = new Map((cats ?? []).map(c => [c.id, c.nombre]))

  // Nombres de contactos (para ventas por cliente)
  const contactoIds = [...new Set((oes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await admin.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const nombreContacto = new Map((contactos ?? []).map(c => [c.id, c.nombre]))

  /* ── Cálculos ── */
  const ventas = (oes ?? []).reduce((s, o) => s + (o.total_cotizacion ?? 0), 0)

  const costoPorOE = new Map<string, number>()
  let costos = 0
  for (const it of items ?? []) {
    const cu    = it.costo_unitario ?? 0
    const cuCOP = it.moneda_costo === 'USD' ? cu * (it.trm ?? 4000) : cu
    const c     = (it.cantidad ?? 0) * cuCOP
    costos += c
    costoPorOE.set(it.orden_ejecucion_id, (costoPorOE.get(it.orden_ejecucion_id) ?? 0) + c)
  }
  costos = Math.round(costos)

  const utilidadBruta = ventas - costos
  const margenBruto   = ventas > 0 ? (utilidadBruta / ventas) * 100 : null

  // Gastos operativos = salidas del mes en operacional/administrativo/financiero
  const gastosOp = (movs ?? []).filter(m => m.tipo === 'salida' && GASTOS_OP.includes(m.clasificacion))
  const totalGastosOp = Math.round(gastosOp.reduce((s, m) => s + m.monto, 0))

  const gastosPorClase = new Map<string, number>()
  const gastosPorCat   = new Map<string, number>()
  for (const g of gastosOp) {
    gastosPorClase.set(g.clasificacion, (gastosPorClase.get(g.clasificacion) ?? 0) + g.monto)
    const cat = g.categoria_id ? (catNombre.get(g.categoria_id) ?? 'Sin categoría') : 'Sin categoría'
    gastosPorCat.set(cat, (gastosPorCat.get(cat) ?? 0) + g.monto)
  }

  const utilidadNeta = utilidadBruta - totalGastosOp
  const margenNeto   = ventas > 0 ? (utilidadNeta / ventas) * 100 : null
  const ticketProm   = (oes?.length ?? 0) > 0 ? Math.round(ventas / (oes?.length ?? 1)) : 0

  const catsOrden = [...gastosPorCat.entries()].sort((a, b) => b[1] - a[1])

  // Detalle: gastos del mes por fecha, y costos agrupados por orden
  const gastosDetalle = [...gastosOp].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
  const costosPorOrden = (oes ?? []).map(o => ({
    oe: o,
    items: (items ?? [])
      .filter(it => it.orden_ejecucion_id === o.id)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map(it => {
        const cu    = it.costo_unitario ?? 0
        const cuCOP = it.moneda_costo === 'USD' ? cu * (it.trm ?? 4000) : cu
        return { ...it, cuCOP, total: Math.round((it.cantidad ?? 0) * cuCOP) }
      }),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      {/* Header + navegación de mes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/finanzas" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">← Finanzas</Link>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Análisis de ventas</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{mesLabel(mes)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/finanzas/analisis?mes=${shiftMes(mes, -1)}`}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Mes anterior</Link>
          <Link href={`/admin/finanzas/analisis?mes=${shiftMes(mes, 1)}`}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Mes siguiente →</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Ventas (sin IVA)', value: ventas,        color: 'text-gray-900',   bg: 'bg-white', href: '#ventas' },
          { label: 'Costos',           value: costos,        color: 'text-rose-600',   bg: 'bg-white', href: '#costos' },
          { label: 'Utilidad bruta',   value: utilidadBruta, color: utilidadBruta >= 0 ? 'text-emerald-700' : 'text-red-600', bg: 'bg-emerald-50', pct: margenBruto },
          { label: 'Gastos operativos',value: totalGastosOp, color: 'text-amber-600',  bg: 'bg-white', href: '#gastos' },
          { label: 'Utilidad neta',    value: utilidadNeta,  color: utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-600', bg: utilidadNeta >= 0 ? 'bg-emerald-50' : 'bg-red-50', pct: margenNeto, strong: true },
        ].map(k => {
          const contenido = (
            <>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">{k.label}</p>
              <p className={`${k.strong ? 'text-2xl' : 'text-xl'} font-bold mt-1 ${k.color}`}>${fmt(k.value)}</p>
              {k.pct != null && (
                <p className={`text-xs mt-0.5 font-medium ${k.pct >= 20 ? 'text-emerald-600' : k.pct >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                  margen {k.pct.toFixed(1)}%
                </p>
              )}
              {k.href && <p className="text-[11px] text-blue-500 mt-1">Ver detalle ↓</p>}
            </>
          )
          return k.href ? (
            <a key={k.label} href={k.href}
              className={`${k.bg} rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all`}>
              {contenido}
            </a>
          ) : (
            <div key={k.label} className={`${k.bg} rounded-xl border border-gray-200 p-4`}>{contenido}</div>
          )
        })}
      </div>

      {/* Estado de resultados (cascada) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg">
        <h2 className="text-sm font-bold text-gray-800 mb-4">Estado de resultados — {mesLabel(mes)}</h2>
        <div className="space-y-2 text-sm">
          <Row label={`Ventas (${oes?.length ?? 0} orden${(oes?.length ?? 0) !== 1 ? 'es' : ''})`} value={ventas} />
          <Row label="− Costos de equipos" value={-costos} muted />
          <div className="border-t border-gray-200 my-1" />
          <Row label="= Utilidad bruta" value={utilidadBruta} bold pct={margenBruto} />
          <Row label="− Gastos operativos" value={-totalGastosOp} muted />
          <div className="border-t-2 border-gray-300 my-1" />
          <Row label="= Utilidad neta" value={utilidadNeta} bold big pct={margenNeto} />
        </div>
        {(oes?.length ?? 0) > 0 && (
          <p className="text-xs text-gray-400 mt-4">Ticket promedio por venta: ${fmt(ticketProm)}</p>
        )}
      </div>

      {/* Gastos operativos: resumen + detalle */}
      <div id="gastos" className="bg-white rounded-2xl border border-gray-200 overflow-hidden scroll-mt-20">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">Gastos operativos ({gastosOp.length})</h2>
          <span className="text-sm font-bold text-amber-600">${fmt(totalGastosOp)}</span>
        </div>
        {gastosOp.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No hay gastos operativos en {mesLabel(mes)}.</p>
        ) : (
          <>
            <div className="px-5 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {GASTOS_OP.map(cl => (
                <div key={cl} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{CLASE_LABEL[cl]}</p>
                  <p className="text-lg font-bold text-gray-800">${fmt(Math.round(gastosPorClase.get(cl) ?? 0))}</p>
                </div>
              ))}
            </div>
            <div className="px-5 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Por categoría</p>
              <div className="divide-y divide-gray-50">
                {catsOrden.map(([cat, monto]) => (
                  <div key={cat} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-600">{cat}</span>
                    <span className="font-medium text-gray-800">${fmt(Math.round(monto))}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Todos los gastos del mes</p>
            </div>
            <div className="divide-y divide-gray-50 border-t border-gray-100">
              {gastosDetalle.map(g => (
                <div key={g.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="text-xs text-gray-400 w-20 shrink-0">
                    {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 truncate">{g.concepto || 'Sin concepto'}</p>
                    <p className="text-xs text-gray-400">
                      {CLASE_LABEL[g.clasificacion]}
                      {g.categoria_id && ` · ${catNombre.get(g.categoria_id) ?? ''}`}
                    </p>
                  </div>
                  <span className="font-medium text-red-600 shrink-0">−${fmt(Math.round(g.monto))}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Costos: equipos de cada orden */}
      <div id="costos" className="bg-white rounded-2xl border border-gray-200 overflow-hidden scroll-mt-20">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">Costos de equipos</h2>
          <span className="text-sm font-bold text-rose-600">${fmt(costos)}</span>
        </div>
        {costosPorOrden.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No hay costos en {mesLabel(mes)}.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {costosPorOrden.map(({ oe, items: its }) => (
              <div key={oe.id}>
                <Link href={`/admin/ordenes/${oe.id}`}
                  className="flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100">
                  <span className="text-sm font-semibold text-gray-700">
                    {oe.consecutivo} · {nombreContacto.get(oe.contacto_id ?? '') ?? 'Cliente'}
                  </span>
                  <span className="text-sm font-bold text-rose-600">${fmt(Math.round(costoPorOE.get(oe.id) ?? 0))}</span>
                </Link>
                {its.map(it => (
                  <div key={it.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 truncate">{it.descripcion}</p>
                      <p className="text-xs text-gray-400">
                        {it.referencia && `${it.referencia} · `}
                        {it.cantidad} × ${fmt(Math.round(it.cuCOP))}
                        {it.moneda_costo === 'USD' && ` (USD ${fmt(it.costo_unitario ?? 0)} · TRM ${fmt(it.trm ?? 4000)})`}
                      </p>
                    </div>
                    <span className="font-medium text-gray-700 shrink-0">${fmt(it.total)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ventas del mes */}
      <div id="ventas" className="bg-white rounded-2xl border border-gray-200 overflow-hidden scroll-mt-20">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">Ventas del mes ({oes?.length ?? 0})</h2>
        </div>
        {(oes?.length ?? 0) === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No hay ventas registradas en {mesLabel(mes)}.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {(oes ?? []).map(o => {
              const venta = o.total_cotizacion ?? 0
              const costo = Math.round(costoPorOE.get(o.id) ?? 0)
              const util  = venta - costo
              const mg    = venta > 0 ? (util / venta) * 100 : null
              return (
                <Link key={o.id} href={`/admin/ordenes/${o.id}`}
                  className="flex items-center px-5 py-3 hover:bg-gray-50 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{nombreContacto.get(o.contacto_id ?? '') ?? 'Cliente'}</p>
                      {o.tipo_venta === 'directa' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">🛒 directa</span>}
                    </div>
                    <p className="text-xs text-gray-400">{o.consecutivo}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-800">${fmt(venta)}</p>
                    {mg != null && (
                      <p className={`text-xs ${mg >= 20 ? 'text-emerald-600' : mg >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                        util. ${fmt(util)} · {mg.toFixed(0)}%
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Ventas y costos son valores sin IVA (el IVA no es utilidad). Los costos salen de los equipos de cada orden.
        Los gastos operativos son las salidas del mes clasificadas como operacional, administrativo o financiero.
      </p>
    </div>
  )
}

function Row({ label, value, bold, big, muted, pct }: {
  label: string; value: number; bold?: boolean; big?: boolean; muted?: boolean; pct?: number | null
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? 'font-bold text-gray-800' : muted ? 'text-gray-500' : 'text-gray-600'} ${big ? 'text-base' : ''}`}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${big ? 'text-lg' : ''} ${value < 0 ? 'text-rose-600' : bold ? (value >= 0 ? 'text-emerald-700' : 'text-red-600') : 'text-gray-800'}`}>
        ${fmt(Math.abs(value))}{pct != null && <span className="text-xs font-normal text-gray-400 ml-2">{pct.toFixed(1)}%</span>}
      </span>
    </div>
  )
}
