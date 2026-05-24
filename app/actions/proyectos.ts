'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { ETAPAS_AV_CATALOGO } from '@/lib/constants'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id) {
    throw new Error('No autorizado')
  }
  return profile
}

export async function crearProyecto(formData: FormData) {
  const profile            = await requireAdmin()
  const supabase           = createAdminClient()
  const nombre             = formData.get('nombre') as string
  const descripcion        = formData.get('descripcion') as string
  const empresa_id         = formData.get('empresa_id') as string
  const cliente_id         = formData.get('cliente_id') as string
  const estado             = formData.get('estado') as string
  const fecha_inicio       = formData.get('fecha_inicio') as string || null
  const fecha_estimada_fin = formData.get('fecha_estimada_fin') as string || null

  if (!empresa_id) throw new Error('Debes seleccionar una empresa para el proyecto')

  const { data: proyecto, error } = await supabase
    .from('proyectos')
    .insert({
      nombre, descripcion, empresa_id,
      cliente_id: cliente_id || null,
      estado, fecha_inicio, fecha_estimada_fin,
      tenant_id: profile.tenant_id,
    })
    .select('id')
    .single()

  if (error || !proyecto) throw new Error(error?.message ?? 'Error creando proyecto')

  await supabase.from('etapas').insert(
    ETAPAS_AV_CATALOGO.map(e => ({
      proyecto_id: proyecto.id,
      nombre: e.nombre,
      orden: e.orden,
      requiere_aprobacion_cliente: e.requiere_aprobacion_cliente,
      estado: 'pendiente',
    }))
  )

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'crear_proyecto',
    entidad:    'proyecto',
    entidadId:  proyecto.id,
    detalles:   { nombre, estado, empresa_id },
  })

  revalidatePath('/admin/proyectos')
  redirect(`/admin/proyectos/${proyecto.id}`)
}

export async function actualizarProyecto(id: string, formData: FormData) {
  const profile            = await requireAdmin()
  const supabase           = createAdminClient()
  const nombre             = formData.get('nombre') as string
  const descripcion        = formData.get('descripcion') as string
  const empresa_id         = formData.get('empresa_id') as string
  const cliente_id         = formData.get('cliente_id') as string
  const estado             = formData.get('estado') as string
  const fecha_inicio       = formData.get('fecha_inicio') as string || null
  const fecha_estimada_fin = formData.get('fecha_estimada_fin') as string || null

  if (!empresa_id) throw new Error('Debes seleccionar una empresa para el proyecto')

  const { error } = await supabase
    .from('proyectos')
    .update({
      nombre, descripcion, empresa_id,
      cliente_id: cliente_id || null,
      estado, fecha_inicio, fecha_estimada_fin,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)  // solo edita sus propios proyectos

  if (error) throw new Error(error.message)

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'editar_proyecto',
    entidad:    'proyecto',
    entidadId:  id,
    detalles:   { nombre, estado },
  })

  revalidatePath(`/admin/proyectos/${id}`)
  revalidatePath('/admin/proyectos')
  redirect(`/admin/proyectos/${id}`)
}

export async function eliminarProyecto(id: string) {
  const profile  = await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('proyectos')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/proyectos')
  redirect('/admin/proyectos')
}

export async function actualizarEtapa(etapaId: string, proyectoId: string, formData: FormData) {
  const supabase     = createAdminClient()
  const estado       = formData.get('estado') as string
  const notas        = formData.get('notas') as string
  const fecha_inicio = formData.get('fecha_inicio') as string || null
  const fecha_fin    = formData.get('fecha_fin') as string || null

  const { error } = await supabase
    .from('etapas')
    .update({ estado, notas, fecha_inicio, fecha_fin, updated_at: new Date().toISOString() })
    .eq('id', etapaId)

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/proyectos/${proyectoId}`)
}
