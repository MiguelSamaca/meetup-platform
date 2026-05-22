'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'

// ── Helpers de autorización ──────────────────────────────────────────────────

async function requireSuperAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'superadmin') {
    throw new Error('No autorizado')
  }
  return profile
}

// ── Tenants ──────────────────────────────────────────────────────────────────

export async function toggleTenant(tenantId: string, activo: boolean) {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
  if (error) throw new Error(error.message)
  revalidatePath('/superadmin/tenants')
}

export async function eliminarTenant(tenantId: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('tenants').delete().eq('id', tenantId)
  if (error) throw new Error(error.message)
  revalidatePath('/superadmin/tenants')
  redirect('/superadmin/tenants')
}

// ── Superadmins ───────────────────────────────────────────────────────────────

export async function crearSuperAdmin(formData: FormData) {
  await requireSuperAdmin()

  const nombre   = formData.get('nombre') as string
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol: 'superadmin' },
  })

  if (authError || !authData.user) throw new Error(authError?.message ?? 'Error creando usuario')

  await admin.from('profiles').upsert({
    id: authData.user.id,
    nombre,
    email,
    rol: 'superadmin',
    tenant_id: null,
    activo: true,
  })

  revalidatePath('/superadmin/admins')
  redirect('/superadmin/admins')
}

export async function eliminarSuperAdmin(id: string) {
  await requireSuperAdmin()

  const admin = createAdminClient()

  // Verificar que no sea el último superadmin
  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('rol', 'superadmin')

  if ((count ?? 0) <= 1) {
    throw new Error('No puedes eliminar el único superadmin.')
  }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/superadmin/admins')
  redirect('/superadmin/admins')
}
