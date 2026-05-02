import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EtapaRow from '@/components/admin/EtapaRow'
import { ESTADO_PROYECTO_LABEL } from '@/lib/constants'
import type { Etapa } from '@/lib/types'

const estadoColor: Record<string, string> = {
  activo:     'bg-emerald-100 text-emerald-700',
  pausado:    'bg-amber-100 text-amber-700',
  completado: 'bg-blue-100 text-blue-700',
  cancelado:  'bg-red-100 text-red-700',
}

export default async function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: proyecto }, { data: etapas }, { data: tickets }] = await Promise.all([
    supabase
      .from('proyectos')
      .select('*, profiles(nombre, empresa, email, telefono)')
      .eq('id', id)
      .single(),
    supabase
      .from('etapas')
      .select('*')
      .eq('proyecto_id', id)
      .order('orden'),
    supabase
      .from('tickets')
      .select('id, consecutivo, titulo, prioridad, estado, created_at')
      .eq('proyecto_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!proyecto) notFound()

  const etapasCompletadas = etapas?.filter(e => ['completado', 'aprobado'].includes(e.estado)).length ?? 0
  const totalEtapas = etapas?.length ?? 0
  const progreso = totalEtapas > 0 ? Math.round((etapasCompletadas / totalEtapas) * 100) : 0

  const cliente = proyecto.profiles as { nombre: string; empresa: string | null; email: string; telefono: string | null } | null

  const prioridadColor: Record<string, string> = {
    baja:    'bg-gray-100 text-gray-600',
    media:   'bg-blue-100 text-blue-700',
    alta:    'bg-amber-100 text-amber-700',
    critica: 'bg-red-100 text-red-700',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/proyectos" className="text-gray-400 hover:text-gray-600 text-sm">← Proyectos</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">{proyecto.nombre}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{proyecto.nombre}</h1>
          {proyecto.descripcion && (
            <p className="text-gray-500 text-sm mt-1">{proyecto.descripcion}</p>
          )}
        </div>
        <Link
          href={`/admin/proyectos/${id}/editar`}
          className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: etapas */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progreso */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Progreso del proyecto</span>
              <span className="text-sm font-bold text-emerald-600">{progreso}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{etapasCompletadas} de {totalEtapas} etapas completadas</p>
          </div>

          {/* Etapas */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Etapas del proyecto</h2>
            </div>
            <ul>
              {etapas?.map(e => (
                <EtapaRow key={e.id} etapa={e as Etapa} proyectoId={id} />
              ))}
              {!etapas?.length && (
                <li className="px-5 py-8 text-center text-gray-400 text-sm">Sin etapas registradas.</li>
              )}
            </ul>
          </div>

          {/* Tickets del proyecto */}
          {tickets && tickets.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Tickets de soporte</h2>
                <Link href={`/admin/tickets?proyecto=${id}`} className="text-xs text-emerald-600 hover:underline">Ver todos</Link>
              </div>
              <ul className="divide-y divide-gray-50">
                {tickets.map(t => (
                  <li key={t.id}>
                    <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{t.titulo}</p>
                        <p className="text-xs text-gray-400">{t.consecutivo}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${prioridadColor[t.prioridad]}`}>
                        {t.prioridad}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar: info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Información del proyecto</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Estado</dt>
                <dd className="mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor[proyecto.estado]}`}>
                    {ESTADO_PROYECTO_LABEL[proyecto.estado]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fecha inicio</dt>
                <dd className="text-gray-700 mt-1">
                  {proyecto.fecha_inicio
                    ? new Date(proyecto.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CO')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Entrega estimada</dt>
                <dd className="text-gray-700 mt-1">
                  {proyecto.fecha_estimada_fin
                    ? new Date(proyecto.fecha_estimada_fin + 'T00:00:00').toLocaleDateString('es-CO')
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {cliente && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Cliente</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nombre</dt>
                  <dd className="text-gray-700 mt-1">{cliente.nombre}</dd>
                </div>
                {cliente.empresa && (
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Empresa</dt>
                    <dd className="text-gray-700 mt-1">{cliente.empresa}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Correo</dt>
                  <dd className="mt-1">
                    <a href={`mailto:${cliente.email}`} className="text-emerald-600 hover:underline">{cliente.email}</a>
                  </dd>
                </div>
                {cliente.telefono && (
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Teléfono</dt>
                    <dd className="text-gray-700 mt-1">{cliente.telefono}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
