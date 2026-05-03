import { createAdminClient } from '@/lib/supabase/admin'
import StatsCard from '@/components/admin/StatsCard'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = createAdminClient()

  const [
    { count: totalProyectos },
    { count: proyectosActivos },
    { count: ticketsAbiertos },
    { count: totalClientes },
    { data: proyectosRecientes },
    { data: ticketsRecientes },
  ] = await Promise.all([
    supabase.from('proyectos').select('*', { count: 'exact', head: true }),
    supabase.from('proyectos').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('rol', 'cliente'),
    supabase.from('proyectos')
      .select('id, nombre, estado, cliente_id, profiles(nombre)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('tickets')
      .select('id, consecutivo, titulo, prioridad, estado, created_at')
      .in('estado', ['abierto', 'en_revision', 'en_campo'])
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const prioridadColor: Record<string, string> = {
    baja:    'bg-gray-100 text-gray-600',
    media:   'bg-blue-100 text-blue-700',
    alta:    'bg-amber-100 text-amber-700',
    critica: 'bg-red-100 text-red-700',
  }

  const estadoProyColor: Record<string, string> = {
    activo:     'bg-emerald-100 text-emerald-700',
    pausado:    'bg-amber-100 text-amber-700',
    completado: 'bg-blue-100 text-blue-700',
    cancelado:  'bg-red-100 text-red-700',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Proyectos totales"  value={totalProyectos ?? 0}   color="emerald" />
        <StatsCard label="Proyectos activos"  value={proyectosActivos ?? 0} color="blue"    />
        <StatsCard label="Tickets abiertos"   value={ticketsAbiertos ?? 0}  color="amber"   />
        <StatsCard label="Clientes"           value={totalClientes ?? 0}    color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proyectos recientes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Proyectos recientes</h2>
            <Link href="/admin/proyectos" className="text-xs text-emerald-600 hover:underline">Ver todos</Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {proyectosRecientes?.map(p => (
              <li key={p.id}>
                <Link href={`/admin/proyectos/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(p.profiles as unknown as { nombre: string } | null)?.nombre ?? '—'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoProyColor[p.estado]}`}>
                    {p.estado}
                  </span>
                </Link>
              </li>
            ))}
            {!proyectosRecientes?.length && (
              <li className="px-5 py-6 text-sm text-gray-400 text-center">Sin proyectos aún</li>
            )}
          </ul>
        </div>

        {/* Tickets recientes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Tickets activos</h2>
            <Link href="/admin/tickets" className="text-xs text-emerald-600 hover:underline">Ver todos</Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {ticketsRecientes?.map(t => (
              <li key={t.id}>
                <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.titulo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.consecutivo}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${prioridadColor[t.prioridad]}`}>
                    {t.prioridad}
                  </span>
                </Link>
              </li>
            ))}
            {!ticketsRecientes?.length && (
              <li className="px-5 py-6 text-sm text-gray-400 text-center">Sin tickets activos</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
