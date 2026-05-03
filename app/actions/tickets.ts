'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function actualizarTicket(id: string, formData: FormData) {
  const admin     = createAdminClient()
  const estado    = formData.get('estado') as string
  const prioridad = formData.get('prioridad') as string

  const { error } = await admin
    .from('tickets')
    .update({ estado, prioridad, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/tickets/${id}`)
  revalidatePath('/admin/tickets')
}

export async function agregarMensajeAdmin(ticketId: string, formData: FormData) {
  const mensaje = (formData.get('mensaje') as string)?.trim()
  if (!mensaje) return

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin.from('ticket_mensajes').insert({
    ticket_id: ticketId,
    autor_id:  user?.id ?? null,
    mensaje,
    leido: true,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/tickets/${ticketId}`)
}

export async function crearTicket(formData: FormData) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const titulo      = (formData.get('titulo') as string).trim()
  const descripcion = (formData.get('descripcion') as string).trim()
  const ubicacion   = (formData.get('ubicacion') as string)?.trim() || null
  const prioridad   = formData.get('prioridad') as string
  const proyecto_id = (formData.get('proyecto_id') as string) || null

  const admin = createAdminClient()

  if (proyecto_id) {
    const { data: proy } = await admin
      .from('proyectos').select('cliente_id').eq('id', proyecto_id).single()
    if (proy?.cliente_id !== user.id) throw new Error('No autorizado')
  }

  const { data: ticket, error } = await admin
    .from('tickets')
    .insert({ titulo, descripcion, ubicacion, prioridad, proyecto_id, cliente_id: user.id, estado: 'abierto' })
    .select('id')
    .single()

  if (error || !ticket) throw new Error(error?.message ?? 'Error creando ticket')

  revalidatePath('/portal/tickets')
  redirect(`/portal/tickets/${ticket.id}`)
}

export async function agregarMensajeCliente(ticketId: string, formData: FormData) {
  const mensaje = (formData.get('mensaje') as string)?.trim()
  if (!mensaje) return

  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('tickets').select('cliente_id').eq('id', ticketId).single()
  if (ticket?.cliente_id !== user.id) throw new Error('No autorizado')

  const { error } = await admin.from('ticket_mensajes').insert({
    ticket_id: ticketId,
    autor_id:  user.id,
    mensaje,
    leido: false,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/portal/tickets/${ticketId}`)
}
