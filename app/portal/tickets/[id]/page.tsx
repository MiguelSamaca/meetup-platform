import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import TicketClientReplyForm from '@/components/portal/TicketClientReplyForm'
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

export default async function PortalTicketDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: ticket }, { data: mensajes }] = await Promise.all([
    admin
      .from('tickets')
      .select('*, proyectos(id, nombre)')
      .eq('id', id)
      .eq('cliente_id', user.id)
      .single(),
    admin
      .from('ticket_mensajes')
      .select('*, profiles(nombre, rol)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!ticket) notFound()

  // Mark admin messages as read since client is viewing
  admin
    .from('ticket_mensajes')
    .update({ leido: true })
    .eq('ticket_id', id)
    .eq('leido', false)
    .then(() => {})

  const proyecto = ticket.proyectos as unknown as { id: string; nombre: string } | null
  const isClosed = ticket.estado === 'cerrado' || ticket.estado === 'resuelto'

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/portal/tickets" className="text-gray-400 hover:text-gray-600 text-sm">← Tickets</Link>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-sm text-gray-500">{ticket.consecutivo}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{ticket.titulo}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${prioridadColor[ticket.prioridad]}`}>
              {PRIORIDAD_TICKET_LABEL[ticket.prioridad]}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadoColor[ticket.estado]}`}>
              {ESTADO_TICKET_LABEL[ticket.estado]}
            </span>
          </div>
        </div>
        {proyecto && (
          <p className="text-sm text-gray-500 mt-1">
            Proyecto: <Link href={`/portal/proyectos/${proyecto.id}`} className="text-emerald-600 hover:underline">{proyecto.nombre}</Link>
          </p>
        )}
        {ticket.ubicacion && (
          <p className="text-sm text-gray-500 mt-0.5">📍 {ticket.ubicacion}</p>
        )}
      </div>

      {/* Thread */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Description */}
        <div className="px-6 py-5 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Descripción del problema</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.descripcion}</p>
        </div>

        {/* Messages */}
        <TicketThread
          ticketId={id}
          initialMensajes={(mensajes ?? []) as any}
        />

        {/* Reply or closed notice */}
        <div className="px-6 pb-6">
          {isClosed ? (
            <div className="border-t border-gray-200 pt-4 text-center">
              <p className="text-sm text-gray-400">
                Este ticket está {ESTADO_TICKET_LABEL[ticket.estado].toLowerCase()}.
                {' '}
                <Link href="/portal/tickets/nuevo" className="text-emerald-600 hover:underline">
                  Abrir uno nuevo
                </Link>
              </p>
            </div>
          ) : (
            <TicketClientReplyForm ticketId={id} />
          )}
        </div>
      </div>

      {/* Info footer */}
      <p className="text-xs text-gray-400 mt-4 text-center">
        Ticket {ticket.consecutivo} · Abierto el {new Date(ticket.created_at).toLocaleDateString('es-CO')}
      </p>
    </div>
  )
}
