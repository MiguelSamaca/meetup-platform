import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ESTADO_TICKET_LABEL, PRIORIDAD_TICKET_LABEL } from '@/lib/constants'

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

export default async function PortalTicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: tickets } = await admin
    .from('tickets')
    .select('id, consecutivo, titulo, estado, prioridad, created_at, proyectos(nombre)')
    .eq('cliente_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis tickets de soporte</h1>
        <Link
          href="/portal/tickets/nuevo"
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo ticket
        </Link>
      </div>

      {tickets && tickets.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Asunto</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Proyecto</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Prioridad</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map(t => {
                const proyecto = t.proyectos as unknown as { nombre: string } | null
                return (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.consecutivo}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{t.titulo}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{proyecto?.nombre ?? '—'}</td>
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
                      <Link href={`/portal/tickets/${t.id}`} className="text-emerald-600 hover:underline text-xs font-medium">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No tienes tickets abiertos.</p>
          <Link
            href="/portal/tickets/nuevo"
            className="inline-block mt-4 text-sm text-emerald-600 hover:underline font-medium"
          >
            Crear el primero →
          </Link>
        </div>
      )}
    </div>
  )
}
