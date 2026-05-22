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

export async function crearContacto(formData: FormData) {
  const profile    = await requireAdmin()
  const admin      = createAdminClient()
  const nombre     = (formData.get('nombre') as string).trim()
  const email      = (formData.get('email') as string)?.trim() || null
  const telefono   = (formData.get('telefono') as string)?.trim() || null
  const cargo      = (formData.get('cargo') as string)?.trim() || null
  const notas      = (formData.get('notas') as string)?.trim() || null
  const empresa_id = (formData.get('empresa_id') as string) || null

  if (empresa_id) {
    const { data: empresa } = await admin
      .from('empresas')
      .select('id')
      .eq('id', empresa_id)
      .eq('tenant_id', profile.tenant_id!)
      .single()
    if (!empresa) throw new Error('Empresa no encontrada en tu cuenta')
  }

  const { error } = await admin.from('contactos').insert({
    nombre, email, telefono, cargo, notas, empresa_id,
    tenant_id: profile.tenant_id,
    activo: true,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/contactos')
  redirect('/admin/contactos')
}

export async function editarContacto(id: string, formData: FormData) {
  const profile    = await requireAdmin()
  const admin      = createAdminClient()
  const nombre     = (formData.get('nombre') as string).trim()
  const email      = (formData.get('email') as string)?.trim() || null
  const telefono   = (formData.get('telefono') as string)?.trim() || null
  const cargo      = (formData.get('cargo') as string)?.trim() || null
  const notas      = (formData.get('notas') as string)?.trim() || null
  const empresa_id = (formData.get('empresa_id') as string) || null
  const activo     = formData.get('activo') === 'true'

  if (empresa_id) {
    const { data: empresa } = await admin
      .from('empresas')
      .select('id')
      .eq('id', empresa_id)
      .eq('tenant_id', profile.tenant_id!)
      .single()
    if (!empresa) throw new Error('Empresa no encontrada en tu cuenta')
  }

  const { error } = await admin
    .from('contactos')
    .update({ nombre, email, telefono, cargo, notas, empresa_id, activo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/contactos')
  redirect('/admin/contactos')
}

export async function eliminarContacto(id: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const { error } = await admin
    .from('contactos')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/contactos')
}
