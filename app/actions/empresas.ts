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

export async function crearEmpresa(formData: FormData) {
  const profile   = await requireAdmin()
  const supabase  = createAdminClient()

  const nombre    = formData.get('nombre') as string
  const nit       = formData.get('nit') as string || null
  const telefono  = formData.get('telefono') as string || null
  const direccion = formData.get('direccion') as string || null

  if (!nombre?.trim()) throw new Error('El nombre de la empresa es obligatorio')

  const { error } = await supabase
    .from('empresas')
    .insert({ nombre: nombre.trim(), nit, telefono, direccion, tenant_id: profile.tenant_id })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/empresas')
  redirect('/admin/empresas')
}

export async function editarEmpresa(id: string, formData: FormData) {
  const profile  = await requireAdmin()
  const supabase = createAdminClient()

  const nombre    = formData.get('nombre') as string
  const nit       = formData.get('nit') as string || null
  const telefono  = formData.get('telefono') as string || null
  const direccion = formData.get('direccion') as string || null
  const activo    = formData.get('activo') === 'true'

  if (!nombre?.trim()) throw new Error('El nombre de la empresa es obligatorio')

  const { error } = await supabase
    .from('empresas')
    .update({ nombre: nombre.trim(), nit, telefono, direccion, activo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)  // garantiza que solo edita sus empresas

  if (error) throw new Error(error.message)

  revalidatePath('/admin/empresas')
  redirect('/admin/empresas')
}

export async function eliminarEmpresa(id: string) {
  const profile  = await requireAdmin()
  const supabase = createAdminClient()

  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('id')
    .eq('empresa_id', id)
    .eq('tenant_id', profile.tenant_id!)
    .limit(1)

  if (proyectos && proyectos.length > 0) {
    throw new Error('No se puede eliminar: la empresa tiene proyectos asociados.')
  }

  await supabase.from('profiles').update({ empresa_id: null }).eq('empresa_id', id)

  const { error } = await supabase
    .from('empresas')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/empresas')
  redirect('/admin/empresas')
}
