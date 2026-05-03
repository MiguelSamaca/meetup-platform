import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ESTADO_PROYECTO_LABEL } from '@/lib/constants'

interface SearchParams { estado?: string; q?: string }

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { estado, q } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('proyectos')
    .select('id, nombre, descripcion, estado, fecha_inicio, fecha_estimada_fin, created_at, profiles(nombre, empresa)')
    .order('created_at', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (q)      query = query.ilike('nombre', `%${q}%`)

  const { data: proyectos } = await query

  const estadoColor: Record<string, string> = {
    activo:     'bg-emerald-100 text-emerald-700',
    pausado:    'bg-amber-100 text-amber-700',
    completado: 'bg-blue-100 text-blue-700',
    cancelado:  'bg-red-100 text-red-700',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
        <Link
          href="/admin/proyectos/nuevo"
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo proyecto
        </Link>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar proyecto..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          name="estado"
          defaultValue={estado ?? ''}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_PROYECTO_LABEL).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          Filtrar
        </button>
        {(estado || q) && (
          <Link href="/admin/proyectos" className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Limpiar
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Proyecto</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Cliente</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Fecha inicio</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {proyectos?.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{p.nombre}</p>
                  {p.descripcion && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.descripcion}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-600">
                  {(p.profiles as unknown as { nombre: string; empresa: string | null } | null)?.nombre ?? '—'}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor[p.estado]}`}>
                    {ESTADO_PROYECTO_LABEL[p.estado]}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {p.fecha_inicio ? new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CO') : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/admin/proyectos/${p.id}`} className="text-emerald-600 hover:underline text-xs font-medium">
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
            {!proyectos?.length && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                  No se encontraron proyectos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
