import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aprobarEtapa } from '@/app/actions/etapas'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import AprobarEtapaButton from '@/components/portal/AprobarEtapaButton'
import { ESTADO_PROYECTO_LABEL, ESTADO_ETAPA_LABEL } from '@/lib/constants'
import type { Evidencia } from '@/lib/types'

const estadoProyectoColor: Record<string, string> = {
  activo:     'bg-emerald-100 text-emerald-700',
  pausado:    'bg-amber-100 text-amber-700',
  completado: 'bg-blue-100 text-blue-700',
  cancelado:  'bg-red-100 text-red-700',
}

function circleClass(estado: string) {
  switch (estado) {
    case 'aprobado':    return 'bg-purple-500 border-purple-500'
    case 'completado':  return 'bg-emerald-500 border-emerald-500'
    case 'en_progreso': return 'bg-blue-500 border-blue-500'
    default:            return 'bg-white border-gray-300'
  }
}

function fileIcon(tipo: string | null): string {
  if (!tipo) return '📎'
  if (tipo.startsWith('image/')) return '🖼️'
  if (tipo === 'application/pdf') return '📄'
  if (tipo.startsWith('video/')) return '🎥'
  return '📎'
}

export default async function PortalProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: proyecto }, { data: etapas }] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, descripcion, estado, fecha_inicio, fecha_estimada_fin')
      .eq('id', id)
      .eq('cliente_id', user.id)
      .single(),
    admin
      .from('etapas')
      .select('*, evidencias(*)')
      .eq('proyecto_id', id)
      .order('orden'),
  ])

  if (!proyecto) notFound()

  const totalEtapas       = etapas?.length ?? 0
  const etapasCompletadas = etapas?.filter(e => ['completado', 'aprobado'].includes(e.estado)).length ?? 0
  const progreso          = totalEtapas > 0 ? Math.round((etapasCompletadas / totalEtapas) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/portal" className="text-gray-400 hover:text-gray-600 text-sm">← Mis proyectos</Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{proyecto.nombre}</h1>
            {proyecto.descripcion && (
              <p className="text-gray-500 text-sm mt-1">{proyecto.descripcion}</p>
            )}
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full shrink-0 ml-4 ${estadoProyectoColor[proyecto.estado]}`}>
            {ESTADO_PROYECTO_LABEL[proyecto.estado]}
          </span>
        </div>
      </div>

      {/* Progress summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Progreso general</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${progreso}%` }} />
            </div>
            <span className="text-sm font-bold text-emerald-600 shrink-0">{progreso}%</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{etapasCompletadas} de {totalEtapas} etapas</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Inicio</p>
          <p className="text-sm text-gray-700">
            {proyecto.fecha_inicio
              ? new Date(proyecto.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CO')
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Entrega estimada</p>
          <p className="text-sm text-gray-700">
            {proyecto.fecha_estimada_fin
              ? new Date(proyecto.fecha_estimada_fin + 'T00:00:00').toLocaleDateString('es-CO')
              : '—'}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <h2 className="text-lg font-bold text-gray-900 mb-5">Etapas del proyecto</h2>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <ol className="space-y-6">
          {etapas?.map(etapa => {
            const evidencias = (etapa as unknown as { evidencias: Evidencia[] }).evidencias ?? []
            const puedeAprobar = etapa.requiere_aprobacion_cliente && etapa.estado === 'completado'

            return (
              <li key={etapa.id} className="relative pl-12">
                {/* Circle */}
                <span className={`absolute left-0 top-1 w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold shrink-0 ${circleClass(etapa.estado)}`}>
                  {etapa.estado === 'aprobado' ? '✓' : etapa.orden}
                </span>

                <div className={`bg-white rounded-xl border p-5 ${puedeAprobar ? 'border-amber-300 shadow-sm' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{etapa.nombre}</h3>
                      {(etapa.fecha_inicio || etapa.fecha_fin) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {etapa.fecha_inicio && new Date(etapa.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CO')}
                          {etapa.fecha_inicio && etapa.fecha_fin && ' → '}
                          {etapa.fecha_fin && new Date(etapa.fecha_fin + 'T00:00:00').toLocaleDateString('es-CO')}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                      etapa.estado === 'aprobado'   ? 'bg-purple-100 text-purple-700' :
                      etapa.estado === 'completado' ? 'bg-emerald-100 text-emerald-700' :
                      etapa.estado === 'en_progreso'? 'bg-blue-100 text-blue-700' :
                                                      'bg-gray-100 text-gray-500'
                    }`}>
                      {ESTADO_ETAPA_LABEL[etapa.estado]}
                    </span>
                  </div>

                  {/* Evidencias */}
                  {evidencias.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Documentos y evidencias</p>
                      <ul className="space-y-1.5">
                        {evidencias.map(ev => (
                          <li key={ev.id}>
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-gray-700 hover:text-emerald-600 hover:underline"
                            >
                              <span>{fileIcon(ev.tipo)}</span>
                              <span className="truncate">{ev.nombre}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Approval */}
                  {puedeAprobar && (
                    <div className="mt-4 pt-3 border-t border-amber-200">
                      <p className="text-sm text-amber-700 font-medium">Esta etapa está lista y requiere tu aprobación para continuar.</p>
                      <AprobarEtapaButton action={aprobarEtapa.bind(null, etapa.id, id)} />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Soporte link */}
      <div className="mt-10 bg-gray-100 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">¿Tienes alguna duda o incidencia?</p>
          <p className="text-sm text-gray-500 mt-1">Abre un ticket de soporte y te respondemos a la brevedad.</p>
        </div>
        <Link
          href="/portal/tickets/nuevo"
          className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
        >
          Abrir ticket
        </Link>
      </div>
    </div>
  )
}
