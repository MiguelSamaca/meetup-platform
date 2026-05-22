import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import StatsCard from '@/components/admin/StatsCard'
import Link from 'next/link'

/* ─── helpers ──────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

type EstadoCot = 'borrador' | 'enviada' | 'aprobada' | 'rechazada'

const PIPELINE_STAGES: { key: EstadoCot; label: string; icon: string; color: string; bg: string; border: string }[] = [
  { key: 'borrador',  label: 'Borrador',  icon: '✏️', color: 'text-gray-600',   bg: 'bg-gray-50',    border: 'border-gray-200' },
  { key: 'enviada',   label: 'Enviada',   icon: '📤', color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  { key: 'aprobada',  label: 'Aprobada',  icon: '✅', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'rechazada', label: 'Rechazada', icon: '❌', color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200' },
]

export default async function AdminDashboard() {
  const profile  = await getCurrentProfile()
  const tenantId = profile?.tenant_id!
  const supabase = createAdminClient()
  const tenantNombre = profile?.tenant_nombre

  const [
    { count: totalProyectos },
    { count: proyectosActivos },
    { count: ticketsAbiertos },
    { count: totalClientes },
    { data: proyectosRecientes },
    { data: ticketsRecientes },
    { data: cotizaciones },
  ] = await Promise.all([
    supabase.from('proyectos').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('proyectos').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('estado', 'activo'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('estado', 'abierto'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('rol', 'cliente'),
    supabase.from('proyectos')
      .select('id, nombre, estado, cliente_id, profiles(nombre)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('tickets')
      .select('id, consecutivo, titulo, prioridad, estado, created_at')
      .eq('tenant_id', tenantId)
      .in('estado', ['abierto', 'en_revision', 'en_campo'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('cotizaciones')
      .select('id, estado, consecutivo, created_at, cotizacion_items(cantidad, precio_unitario, descuento)')
      .eq('tenant_id', tenantId),
  ])

  /* ── Calcular totales por estado ── */
  type CotRow = {
    id: string
    estado: string
    consecutivo: string
    created_at: string
    cotizacion_items: { cantidad: number; precio_unitario: number; descuento: number }[]
  }

  function rowTotal(cot: CotRow) {
    return (cot.cotizacion_items ?? []).reduce((acc, it) => {
      const base = (it.cantidad ?? 0) * (it.precio_unitario ?? 0)
      const desc = Math.min(Math.max(it.descuento ?? 0, 0), 100)
      return acc + base * (1 - desc / 100)
    }, 0)
  }

  const byEstado: Record<EstadoCot, { count: number; total: number }> = {
    borrador:  { count: 0, total: 0 },
    enviada:   { count: 0, total: 0 },
    aprobada:  { count: 0, total: 0 },
    rechazada: { count: 0, total: 0 },
  }

  for (const cot of (cotizaciones ?? []) as CotRow[]) {
    const key = (cot.estado ?? 'borrador') as EstadoCot
    if (byEstado[key] !== undefined) {
      byEstado[key].count++
      byEstado[key].total += rowTotal(cot)
    }
  }

  const totalCotizado    = Object.values(byEstado).reduce((s, v) => s + v.total, 0)
  const totalAprobado    = byEstado.aprobada.total
  const totalNegociacion = byEstado.enviada.total
  const totalCots        = (cotizaciones ?? []).length
  const tasaConversion   = totalCots > 0
    ? Math.round((byEstado.aprobada.count / (byEstado.aprobada.count + byEstado.rechazada.count || 1)) * 100)
    : 0

  /* Pipeline stages sin rechazada (funnel activo) */
  const funnelStages = PIPELINE_STAGES.filter(s => s.key !== 'rechazada')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{tenantNombre ?? 'Dashboard'}</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen de tu empresa.</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Proyectos activos"  value={proyectosActivos ?? 0} sub={`de ${totalProyectos ?? 0} total`} />
        <StatsCard label="Tickets abiertos"   value={ticketsAbiertos ?? 0}  sub="requieren atención" />
        <StatsCard label="Clientes"           value={totalClientes ?? 0}    sub="usuarios activos" />
        <StatsCard label="Total proyectos"    value={totalProyectos ?? 0}   sub="histórico" />
      </div>

      {/* ── Pipeline de Ventas ── */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">Pipeline de Cotizaciones</h2>
            <p className="text-xs text-gray-400 mt-0.5">Estado actual del embudo de ventas</p>
          </div>
          <Link href="/admin/cotizaciones" className="text-xs text-emerald-600 hover:underline">Ver todas →</Link>
        </div>

        {/* Métricas de ventas */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total cotizado</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalCotizado)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{totalCots} cotizaciones</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">En negociación</p>
            <p className="text-lg font-bold text-blue-600">{fmt(totalNegociacion)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{byEstado.enviada.count} cotizaciones</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Aprobado</p>
            <p className="text-lg font-bold text-emerald-600">{fmt(totalAprobado)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{byEstado.aprobada.count} cotizaciones</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Tasa de cierre</p>
            <p className="text-lg font-bold text-gray-800">{tasaConversion}%</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {byEstado.rechazada.count} rechazadas · {byEstado.aprobada.count} aprobadas
            </p>
          </div>
        </div>

        {/* Funnel visual — tarjetas horizontales */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            {funnelStages.map((stage, i) => {
              const data = byEstado[stage.key]
              return (
                <div key={stage.key} className="flex items-center gap-2 flex-1">
                  {/* Tarjeta de etapa */}
                  <div className={`flex-1 rounded-xl border-2 ${stage.border} ${stage.bg} px-4 py-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${stage.color} mb-1`}>
                      {stage.icon} {stage.label}
                    </p>
                    <p className={`text-3xl font-bold ${stage.color} leading-none mb-2`}>{data.count}</p>
                    <p className="text-sm font-semibold text-gray-700">{fmt(data.total)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {data.count === 1 ? '1 cotización' : `${data.count} cotizaciones`}
                    </p>
                  </div>
                  {/* Flecha */}
                  {i < funnelStages.length - 1 && (
                    <span className="text-gray-300 text-xl font-light flex-shrink-0">›</span>
                  )}
                </div>
              )
            })}

            {/* Separador */}
            <div className="w-px h-20 bg-gray-200 flex-shrink-0 mx-1" />

            {/* Rechazadas */}
            {(() => {
              const stage = PIPELINE_STAGES.find(s => s.key === 'rechazada')!
              const data  = byEstado.rechazada
              return (
                <div className={`rounded-xl border-2 ${stage.border} ${stage.bg} px-4 py-4`} style={{ minWidth: 150 }}>
                  <p className={`text-xs font-bold uppercase tracking-wide ${stage.color} mb-1`}>
                    {stage.icon} {stage.label}
                  </p>
                  <p className={`text-3xl font-bold ${stage.color} leading-none mb-2`}>{data.count}</p>
                  <p className="text-sm font-semibold text-gray-700">{fmt(data.total)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {data.count === 1 ? '1 cotización' : `${data.count} cotizaciones`}
                  </p>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Grid inferior ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proyectos recientes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Proyectos recientes</h2>
            <Link href="/admin/proyectos" className="text-xs text-emerald-600 hover:underline">Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {proyectosRecientes?.map(p => {
              const cliente = p.profiles as unknown as { nombre: string } | null
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{cliente?.nombre ?? 'Sin asignar'}</p>
                  </div>
                  <Link href={`/admin/proyectos/${p.id}`} className="text-xs text-emerald-600 hover:underline">Ver →</Link>
                </div>
              )
            })}
            {!proyectosRecientes?.length && (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No hay proyectos aún.</p>
            )}
          </div>
        </div>

        {/* Tickets recientes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Tickets pendientes</h2>
            <Link href="/admin/tickets" className="text-xs text-emerald-600 hover:underline">Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {ticketsRecientes?.map(t => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.titulo}</p>
                  <p className="text-xs text-gray-400 font-mono">{t.consecutivo}</p>
                </div>
                <Link href={`/admin/tickets/${t.id}`} className="text-xs text-emerald-600 hover:underline">Ver →</Link>
              </div>
            ))}
            {!ticketsRecientes?.length && (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No hay tickets pendientes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
