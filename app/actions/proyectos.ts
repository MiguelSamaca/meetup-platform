'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ETAPAS_AV_CATALOGO } from '@/lib/constants'

export async function crearProyecto(formData: FormData) {
  const supabase = createAdminClient()

  const nombre             = formData.get('nombre') as string
  const descripcion        = formData.get('descripcion') as string
  const cliente_id         = formData.get('cliente_id') as string
  const estado             = formData.get('estado') as string
  const fecha_inicio       = formData.get('fecha_inicio') as string || null
  const fecha_estimada_fin = formData.get('fecha_estimada_fin') as string || null

  const { data: proyecto, error } = await supabase
    .from('proyectos')
    .insert({ nombre, descripcion, cliente_id: cliente_id || null, estado, fecha_inicio, fecha_estimada_fin })
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

  revalidatePath('/admin/proyectos')
  redirect(`/admin/proyectos/${proyecto.id}`)
}

export async function actualizarProyecto(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const nombre             = formData.get('nombre') as string
  const descripcion        = formData.get('descripcion') as string
  const cliente_id         = formData.get('cliente_id') as string
  const estado             = formData.get('estado') as string
  const fecha_inicio       = formData.get('fecha_inicio') as string || null
  const fecha_estimada_fin = formData.get('fecha_estimada_fin') as string || null

  const { error } = await supabase
    .from('proyectos')
    .update({ nombre, descripcion, cliente_id: cliente_id || null, estado, fecha_inicio, fecha_estimada_fin, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/proyectos/${id}`)
  revalidatePath('/admin/proyectos')
  redirect(`/admin/proyectos/${id}`)
}

export async function actualizarEtapa(etapaId: string, proyectoId: string, formData: FormData) {
  const supabase = createAdminClient()

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
