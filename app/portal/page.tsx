import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ESTADO_PROYECTO_LABEL } from '@/lib/constants'

const estadoColor: Record<string, string> = {
  activo:     'bg-emerald-100 text-emerald-700',
  pausado:    'bg-amber-100 text-amber-700',
  completado: 'bg-blue-100 text-blue-700',
  cancelado:  'bg-red-100 text-red-700',
}

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre, descripcion, estado, fecha_estimada_fin, etapas(estado)')
    .eq('cliente_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis proyectos</h1>

      {proyectos && proyectos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {proyectos.map(p => {
            const etapas = p.etapas as { estado: string }[]
            const total       = etapas.length
            const completadas = etapas.filter(e => ['completado', 'aprobado'].includes(e.estado)).length
            const progreso    = total > 0 ? Math.round((completadas / total) * 100) : 0
            const pendAprobacion = etapas.some(e => e.estado === 'completado')

            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-bold text-gray-900 text-lg leading-tight">{p.nombre}</h2>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ml-3 ${estadoColor[p.estado]}`}>
                    {ESTADO_PROYECTO_LABEL[p.estado]}
                  </span>
                </div>

                {p.descripcion && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{p.descripcion}</p>
                )}

                {/* Progreso */}
                <div className="mt-auto">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-500">Progreso</span>
                    <span className="text-xs font-bold text-emerald-600">{progreso}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${progreso}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">{completadas} de {total} etapas</p>
                    {pendAprobacion && (
                      <span className="text-xs font-medium text-amber-600">⏳ Requiere tu aprobación</span>
                    )}
                  </div>

                  {p.fecha_estimada_fin && (
                    <p className="text-xs text-gray-400 mt-1">
                      Entrega estimada: {new Date(p.fecha_estimada_fin + 'T00:00:00').toLocaleDateString('es-CO')}
                    </p>
                  )}

                  <Link
                    href={`/portal/proyectos/${p.id}`}
                    className="mt-4 block text-center bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Ver proyecto →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No tienes proyectos asignados aún.</p>
          <p className="text-gray-400 text-sm mt-1">Contacta con tu asesor para más información.</p>
        </div>
      )}
    </div>
  )
}
