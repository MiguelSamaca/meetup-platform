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

/* ─────────────────────────────────────────────────────────────
   Crear Proyecto desde Orden de Ejecución
───────────────────────────────────────────────────────────── */
export async function crearProyectoDesdeOE(oeId: string) {
  const profile = await requireAdmin()
  const supabase = createAdminClient()

  // ¿Ya existe un proyecto para esta OE?
  const { data: existing } = await supabase
    .from('proyectos')
    .select('id')
    .eq('orden_ejecucion_id', oeId)
    .maybeSingle()

  if (existing) redirect(`/admin/proyectos/${existing.id}`)

  // Leer OE
  const { data: oe } = await supabase
    .from('ordenes_ejecucion')
    .select('id, consecutivo, contacto_id')
    .eq('id', oeId)
    .eq('tenant_id', profile.tenant_id!)
    .single()

  if (!oe) throw new Error('Orden no encontrada')

  // Leer contacto para obtener nombre y empresa
  const { data: contacto } = await supabase
    .from('contactos')
    .select('nombre, empresa_id')
    .eq('id', oe.contacto_id)
    .maybeSingle()

  const nombre      = contacto?.nombre ?? oe.consecutivo
  const empresa_id  = (contacto as any)?.empresa_id ?? null
  const hoy         = new Date().toISOString().split('T')[0]

  const { data: proyecto, error } = await supabase
    .from('proyectos')
    .insert({
      tenant_id:          profile.tenant_id,
      orden_ejecucion_id: oeId,
      contacto_id:        oe.contacto_id,
      empresa_id,
      nombre,
      estado:             'activo',
      fecha_inicio:       hoy,
    })
    .select('id')
    .single()

  if (error || !proyecto) throw new Error(error?.message ?? 'Error creando proyecto')

  // Auto-crear las 10 etapas AV
  // Etapa 4 "Compra y logística" ya completada (la OE lo cubrió)
  await supabase.from('etapas').insert(
    ETAPAS_AV_CATALOGO.map(e => ({
      proyecto_id:                  proyecto.id,
      nombre:                       e.nombre,
      orden:                        e.orden,
      requiere_aprobacion_cliente:  e.requiere_aprobacion_cliente,
      estado:                       e.orden === 4 ? 'completado' : 'pendiente',
    }))
  )

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'crear_proyecto',
    entidad:    'proyecto',
    entidadId:  proyecto.id,
    detalles:   { nombre, oe_id: oeId, desde_oe: true },
  })

  revalidatePath(`/admin/ordenes/${oeId}`)
  revalidatePath('/admin/proyectos')
  redirect(`/admin/proyectos/${proyecto.id}`)
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
