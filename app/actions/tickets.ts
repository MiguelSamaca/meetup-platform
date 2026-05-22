'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'

export async function eliminarTicket(id: string) {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin') throw new Error('No autorizado')

  const admin = createAdminClient()

  // Verificar que el ticket pertenece al tenant del admin
  const { data: ticket } = await admin
    .from('tickets')
    .select('tenant_id')
    .eq('id', id)
    .single()

  if (!ticket || ticket.tenant_id !== profile.tenant_id) throw new Error('No autorizado')

  const { error } = await admin.from('tickets').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/tickets')
  redirect('/admin/tickets')
}

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

  const admin   = createAdminClient()
  const profile = await getCurrentProfile()

  if (!profile?.tenant_id) throw new Error('Tu cuenta no tiene empresa asignada')

  if (proyecto_id) {
    const { data: proy } = await admin
      .from('proyectos')
      .select('empresa_id, tenant_id')
      .eq('id', proyecto_id)
      .single()

    if (!proy || proy.tenant_id !== profile.tenant_id) {
      throw new Error('No autorizado: el proyecto no pertenece a tu empresa')
    }
  }

  const { data: ticket, error } = await admin
    .from('tickets')
    .insert({
      titulo, descripcion, ubicacion, prioridad,
      proyecto_id, cliente_id: user.id,
      estado: 'abierto',
      tenant_id: profile.tenant_id,
    })
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

  const admin   = createAdminClient()
  const profile = await getCurrentProfile()

  const { data: ticket } = await admin
    .from('tickets')
    .select('cliente_id, proyecto_id, tenant_id, proyectos(empresa_id)')
    .eq('id', ticketId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proyectoRaw       = ticket?.proyectos as any
  const proyectoEmpresaId = (Array.isArray(proyectoRaw) ? proyectoRaw[0] : proyectoRaw)?.empresa_id as string | undefined
  const esTicketPropio    = ticket?.cliente_id === user.id
  const esDesuEmpresa     = profile?.tenant_id && ticket?.tenant_id === profile.tenant_id

  if (!esTicketPropio && !esDesuEmpresa) throw new Error('No autorizado')

  const { error } = await admin.from('ticket_mensajes').insert({
    ticket_id: ticketId,
    autor_id:  user.id,
    mensaje,
    leido: false,
  })

  if (error) throw new Error(error.message)

  // Suprimir advertencia de variable no usada
  void proyectoEmpresaId

  revalidatePath(`/portal/tickets/${ticketId}`)
}
