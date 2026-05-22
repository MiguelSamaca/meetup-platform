'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id) {
    throw new Error('No autorizado')
  }
  return profile
}

export async function crearProducto(formData: FormData) {
  const profile    = await requireAdmin()
  const admin      = createAdminClient()
  const referencia  = (formData.get('referencia')  as string)?.trim() || null
  const proveedor   = (formData.get('proveedor')   as string)?.trim() || null
  const descripcion = (formData.get('descripcion') as string).trim()
  const unidad      = (formData.get('unidad')      as string)?.trim() || 'und'
  const foto_url    = (formData.get('foto_url')    as string)?.trim() || null

  const { error } = await admin.from('productos').insert({
    tenant_id: profile.tenant_id,
    referencia,
    proveedor,
    descripcion,
    unidad,
    foto_url,
    activo: true,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/productos')
  redirect('/admin/productos')
}

export async function editarProducto(id: string, formData: FormData) {
  const profile     = await requireAdmin()
  const admin       = createAdminClient()
  const referencia  = (formData.get('referencia')  as string)?.trim() || null
  const proveedor   = (formData.get('proveedor')   as string)?.trim() || null
  const descripcion = (formData.get('descripcion') as string).trim()
  const unidad      = (formData.get('unidad')      as string)?.trim() || 'und'
  const activo      = formData.get('activo') === 'true'
  const foto_url    = (formData.get('foto_url')    as string)?.trim() || null

  const { error } = await admin
    .from('productos')
    .update({ referencia, proveedor, descripcion, unidad, activo, foto_url, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/productos')
  redirect('/admin/productos')
}

export async function eliminarProducto(id: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const { error } = await admin
    .from('productos')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/productos')
}
