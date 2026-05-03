import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ESTADO_TICKET_LABEL, PRIORIDAD_TICKET_LABEL } from '@/lib/constants'

interface SearchParams { estado?: string; prioridad?: string; q?: string; proyecto?: string }

const estadoColor: Record<string, string> = {
  abierto:     'bg-emerald-100 text-emerald-700',
  en_revision: 'bg-blue-100 text-blue-700',
  en_campo:    'bg-amber-100 text-amber-700',
  resuelto:    'bg-gray-100 text-gray-600',
  cerrado:     'bg-gray-200 text-gray-500',
}

const prioridadColor: Record<string, string> = {
  baja:    'bg-gray-100 text-gray-600',
  media:   'bg-blue-100 text-blue-700',
  alta:    'bg-amber-100 text-amber-700',
  critica: 'bg-red-100 text-red-700',
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { estado, prioridad, q, proyecto } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('tickets')
    .select('id, consecutivo, titulo, estado, prioridad, created_at, proyectos(id, nombre), profiles(nombre)')
    .order('created_at', { ascending: false })

  if (estado)   query = query.eq('estado', estado)
  if (prioridad) query = query.eq('prioridad', prioridad)
  if (proyecto)  query = query.eq('proyecto_id', proyecto)
  if (q)         query = query.ilike('titulo', `%${q}%`)

  const { data: tickets } = await query

  const hayFiltros = !!(estado || prioridad || q || proyecto)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets de soporte</h1>
        <span className="text-sm text-gray-400">{tickets?.length ?? 0} tickets</span>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por título..."
          className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          name="estado"
          defaultValue={estado ?? ''}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_TICKET_LABEL).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          name="prioridad"
          defaultValue={prioridad ?? ''}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todas las prioridades</option>
          {Object.entries(PRIORIDAD_TICKET_LABEL).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          Filtrar
        </button>
        {hayFiltros && (
          <Link
            href="/admin/tickets"
            className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Título</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Cliente</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Proyecto</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Prioridad</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tickets?.map(t => {
              const proyecto = t.proyectos as unknown as { id: string; nombre: string } | null
              const cliente  = t.profiles  as unknown as { nombre: string } | null
              return (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.consecutivo}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{t.titulo}</td>
                  <td className="px-5 py-3 text-gray-600">{cliente?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {proyecto ? (
                      <Link href={`/admin/proyectos/${proyecto.id}`} className="hover:text-emerald-600 hover:underline">
                        {proyecto.nombre}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${prioridadColor[t.prioridad]}`}>
                      {PRIORIDAD_TICKET_LABEL[t.prioridad]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor[t.estado]}`}>
                      {ESTADO_TICKET_LABEL[t.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(t.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/tickets/${t.id}`} className="text-emerald-600 hover:underline text-xs font-medium">
                      Ver →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {!tickets?.length && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  No se encontraron tickets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
