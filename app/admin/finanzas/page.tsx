import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { Suspense } from 'react'
import PeriodoSelector from '@/components/admin/finanzas/PeriodoSelector'
import SaldoCajaEditor from '@/components/admin/finanzas/SaldoCajaEditor'
import Link from 'next/link'

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function getRangoFechas(periodo: string): { desde: string; hasta: string } {
  const hoy  = new Date()
  const hasta = hoy.toISOString()

  if (periodo === 'mes') {
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
    return { desde, hasta }
  }
  if (periodo === 'trimestre') {
    const mes    = hoy.getMonth()
    const inicio = Math.floor(mes / 3) * 3
    const desde  = new Date(hoy.getFullYear(), inicio, 1).toISOString()
    return { desde, hasta }
  }
  if (periodo === 'anio') {
    const desde = new Date(hoy.getFullYear(), 0, 1).toISOString()
    return { desde, hasta }
  }
  // 'todo'
  return { desde: '2000-01-01T00:00:00Z', hasta }
}

/* ── KPI Card ── */
function KPICard({
  label, valor, sub, color = 'gray', icon,
}: {
  label: string; valor: string; sub?: string
  color?: 'gray' | 'emerald' | 'blue' | 'red' | 'amber'; icon: string
}) {
  const colorMap = {
    gray:    'text-gray-900',
    emerald: 'text-emerald-600',
    blue:    'text-blue-600',
    red:     'text-red-600',
    amber:   'text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

/* ── Badge estado cobro ── */
function EstadoCobro({ anticipo, saldo }: { anticipo: boolean; saldo: boolean }) {
  if (saldo)    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Pagado</span>
  if (anticipo) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Anticipo ✓</span>
  return          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Pendiente</span>
}

/* ── Page ── */
export default async function FinanzasDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>
}) {
  const { p } = await searchParams
  const periodo = p ?? 'mes'
  const { desde, hasta } = getRangoFechas(periodo)

  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const tid      = profile?.tenant_id!

  /* ── Queries paralelas ── */
  const [
    { data: oes },
    { data: gastos },
    { count: proyActivos },
    { data: configCaja },
    { data: gastosFijos },
  ] = await Promise.all([
    supabase
      .from('ordenes_ejecucion')
      .select('id, consecutivo, estado, total_cotizacion, total_con_iva, anticipo_porcentaje, anticipo_monto, anticipo_recibido, saldo_recibido, cotizacion_id, contacto_id, created_at')
      .eq('tenant_id', tid)
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: false }),
    supabase
      .from('gastos')
      .select('monto')
      .eq('tenant_id', tid)
      .gte('fecha', desde.split('T')[0])
      .lte('fecha', hasta.split('T')[0]),
    supabase
      .from('proyectos')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tid)
      .eq('estado', 'activo'),
    supabase
      .from('tenant_config')
      .select('saldo_caja_actual')
      .eq('tenant_id', tid)
      .maybeSingle(),
    supabase
      .from('gastos_fijos')
      .select('monto')
      .eq('tenant_id', tid)
      .eq('activo', true),
  ])

  const saldoCajaActual  = (configCaja as any)?.saldo_caja_actual ?? 0
  const totalGastosFijos = (gastosFijos ?? []).reduce((s, g) => s + (g.monto ?? 0), 0)

  /* ── Cálculo de KPIs — todo con IVA (valores reales de caja) ── */
  const totalFacturado  = (oes ?? []).reduce((s, o) => {
    // Usar total_con_iva si existe, sino calcular
    return s + (o.total_con_iva ?? Math.round((o.total_cotizacion ?? 0) * 1.19))
  }, 0)
  const totalRecaudado  = (oes ?? []).reduce((s, o) => {
    const totalIva   = o.total_con_iva ?? Math.round((o.total_cotizacion ?? 0) * 1.19)
    const anticIva   = Math.round(totalIva * (o.anticipo_porcentaje ?? 50) / 100)
    const ant = o.anticipo_recibido ? anticIva : 0
    const sal = o.saldo_recibido    ? Math.max(0, totalIva - anticIva) : 0
    return s + ant + sal
  }, 0)
  const totalPendiente  = totalFacturado - totalRecaudado
  const totalGastos     = (gastos ?? []).reduce((s, g) => s + (g.monto ?? 0), 0)
  const cantOes         = oes?.length ?? 0

  /* ── Contactos para la tabla ── */
  const contactoIds = [...new Set((oes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await supabase.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const contactoMap = new Map((contactos ?? []).map(c => [c.id, c.nombre]))

  const PERIODO_LABEL: Record<string, string> = {
    mes: 'este mes', trimestre: 'este trimestre', anio: 'este año', todo: 'en total',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Financiero</h1>
          <p className="text-sm text-gray-500 mt-1">
            Resumen financiero {PERIODO_LABEL[periodo]} — {cantOes} orden{cantOes !== 1 ? 'es' : ''} de ejecución
          </p>
        </div>
        <Suspense>
          <PeriodoSelector />
        </Suspense>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Caja actual — el primero y más importante */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">💰 Caja actual</p>
            <span className="text-xl">💰</span>
          </div>
          <SaldoCajaEditor saldoActual={saldoCajaActual} />
          <p className="text-xs text-emerald-600 mt-1">Actualiza cuando recibas pagos</p>
        </div>
        <KPICard
          label="Total facturado"
          valor={`$${fmt(totalFacturado)}`}
          sub={`${cantOes} OE${cantOes !== 1 ? 's' : ''} · c/IVA`}
          color="gray"
          icon="💼"
        />
        <KPICard
          label="Recaudado"
          valor={`$${fmt(totalRecaudado)}`}
          sub={totalFacturado > 0 ? `${Math.round(totalRecaudado / totalFacturado * 100)}% del facturado` : '—'}
          color="emerald"
          icon="✅"
        />
        <KPICard
          label="Pendiente de cobro"
          valor={`$${fmt(totalPendiente)}`}
          sub={totalFacturado > 0 ? `${Math.round(totalPendiente / totalFacturado * 100)}% por cobrar` : '—'}
          color={totalPendiente > 0 ? 'amber' : 'gray'}
          icon="⏳"
        />
      </div>

      {/* Banner de proyección con gastos fijos */}
      {totalGastosFijos > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                📅 Gastos fijos mensuales activos: <span className="text-amber-800">${fmt(totalGastosFijos)}/mes</span>
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-amber-700">
                <span>Con caja actual de <strong>${fmt(saldoCajaActual)}</strong> y sin nuevos cobros, la caja dura aprox. <strong>{totalGastosFijos > 0 ? Math.floor(saldoCajaActual / totalGastosFijos) : '∞'} mes{Math.floor(saldoCajaActual / totalGastosFijos) !== 1 ? 'es' : ''}</strong></span>
                <span>·</span>
                <span>Con cobros pendientes de <strong>${fmt(totalPendiente)}</strong>, en total tendrías <strong>${fmt(saldoCajaActual + totalPendiente)}</strong></span>
              </div>
            </div>
            <Link href="/admin/finanzas/flujo" className="text-xs bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors font-semibold whitespace-nowrap">
              Ver proyección →
            </Link>
          </div>
        </div>
      )}

      {/* Accesos rápidos a submódulos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {[
          { href: '/admin/finanzas/cobrar',       icon: '📥', label: 'Por cobrar',     desc: 'Pagos de clientes',      color: 'border-emerald-200 hover:bg-emerald-50' },
          { href: '/admin/finanzas/pagar',         icon: '📤', label: 'Por pagar',      desc: 'Pagos a proveedores',    color: 'border-blue-200 hover:bg-blue-50'     },
          { href: '/admin/finanzas/rentabilidad',  icon: '📊', label: 'Rentabilidad',   desc: 'Margen por proyecto',    color: 'border-purple-200 hover:bg-purple-50' },
          { href: '/admin/finanzas/flujo',         icon: '🔄', label: 'Flujo de caja',  desc: 'Proyección mensual',     color: 'border-amber-200 hover:bg-amber-50'   },
          { href: '/admin/finanzas/gastos-fijos',  icon: '📅', label: 'Gastos fijos',   desc: 'Recurrentes mensuales',  color: 'border-orange-200 hover:bg-orange-50' },
        ].map(m => (
          <Link
            key={m.href}
            href={m.href}
            className={`bg-white rounded-xl border p-4 transition-colors ${m.color}`}
          >
            <span className="text-2xl block mb-2">{m.icon}</span>
            <p className="text-sm font-semibold text-gray-800">{m.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
          </Link>
        ))}
      </div>

      {/* Tabla resumen de OEs del período */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Órdenes de ejecución — {PERIODO_LABEL[periodo]}
          </h2>
          <Link href="/admin/finanzas/cobrar" className="text-xs text-emerald-600 hover:underline font-medium">
            Ver detalle →
          </Link>
        </div>

        {(oes ?? []).length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">
            Sin órdenes en este período.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">OE #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Facturado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Recaudado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Estado cobro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(oes ?? []).map(oe => {
                const totalIva  = oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19)
                const anticIva  = Math.round(totalIva * (oe.anticipo_porcentaje ?? 50) / 100)
                const recaudado = (oe.anticipo_recibido ? anticIva : 0)
                  + (oe.saldo_recibido ? Math.max(0, totalIva - anticIva) : 0)
                const pendiente = Math.max(0, totalIva - recaudado)

                return (
                  <tr key={oe.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/ordenes/${oe.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                        {oe.consecutivo}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-700 font-medium">
                      {contactoMap.get(oe.contacto_id ?? '') ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      ${fmt(oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19))}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-600">
                      ${fmt(recaudado)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-amber-600">
                      {pendiente > 0 ? `$${fmt(pendiente)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <EstadoCobro anticipo={oe.anticipo_recibido} saldo={oe.saldo_recibido} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Totales del período</td>
                <td className="px-5 py-3 text-right font-bold text-gray-900">${fmt(totalFacturado)}</td>
                <td className="px-5 py-3 text-right font-bold text-emerald-600">${fmt(totalRecaudado)}</td>
                <td className="px-5 py-3 text-right font-bold text-amber-600">
                  {totalPendiente > 0 ? `$${fmt(totalPendiente)}` : '—'}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
