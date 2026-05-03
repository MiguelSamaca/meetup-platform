import { createAdminClient } from '@/lib/supabase/admin'
import { actualizarTicket } from '@/app/actions/tickets'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TicketReplyForm from '@/components/admin/TicketReplyForm'
import TicketThread from '@/components/TicketThread'
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

export default async function TicketDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: ticket }, { data: mensajes }] = await Promise.all([
    supabase
      .from('tickets')
      .select('*, proyectos(id, nombre), profiles(nombre, empresa, email)')
      .eq('id', id)
      .single(),
    supabase
      .from('ticket_mensajes')
      .select('*, profiles(nombre, rol)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!ticket) notFound()

  // Mark unread client messages as read
  supabase
    .from('ticket_mensajes')
    .update({ leido: true })
    .eq('ticket_id', id)
    .eq('leido', false)
    .then(() => {})

  const proyecto = ticket.proyectos as unknown as { id: string; nombre: string } | null
  const cliente  = ticket.profiles  as unknown as { nombre: string; empresa: string | null; email: string } | null

  const updateAction = actualizarTicket.bind(null, id)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/tickets" className="text-gray-400 hover:text-gray-600 text-sm">← Tickets</Link>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-sm text-gray-500">{ticket.consecutivo}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ticket.titulo}</h1>
            {ticket.ubicacion && (
              <p className="text-sm text-gray-500 mt-1">📍 {ticket.ubicacion}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${prioridadColor[ticket.prioridad]}`}>
              {PRIORIDAD_TICKET_LABEL[ticket.prioridad]}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadoColor[ticket.estado]}`}>
              {ESTADO_TICKET_LABEL[ticket.estado]}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Descripción</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Conversación</h2>
            </div>

            <TicketThread
              ticketId={id}
              initialMensajes={(mensajes ?? []) as any}
              isAdmin
            />

            <div className="px-5 pb-5">
              <TicketReplyForm ticketId={id} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Update status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Actualizar ticket</h3>
            <form action={updateAction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                <select
                  name="estado"
                  defaultValue={ticket.estado}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(ESTADO_TICKET_LABEL).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Prioridad</label>
                <select
                  name="prioridad"
                  defaultValue={ticket.prioridad}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(PRIORIDAD_TICKET_LABEL).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Guardar cambios
              </button>
            </form>
          </div>

          {/* Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Información</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Consecutivo</dt>
                <dd className="font-mono text-gray-700 mt-1">{ticket.consecutivo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Creado</dt>
                <dd className="text-gray-700 mt-1">
                  {new Date(ticket.created_at).toLocaleDateString('es-CO')}
                </dd>
              </div>
              {proyecto && (
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Proyecto</dt>
                  <dd className="mt-1">
                    <Link href={`/admin/proyectos/${proyecto.id}`} className="text-emerald-600 hover:underline">
                      {proyecto.nombre}
                    </Link>
                  </dd>
                </div>
              )}
              {cliente && (
                <>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cliente</dt>
                    <dd className="text-gray-700 mt-1">{cliente.nombre}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Correo</dt>
                    <dd className="mt-1">
                      <a href={`mailto:${cliente.email}`} className="text-emerald-600 hover:underline">
                        {cliente.email}
                      </a>
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
