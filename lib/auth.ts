/**
 * Helper para obtener el perfil del usuario autenticado en server components y actions.
 * Devuelve id, rol, tenant_id y nombre del usuario actual.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getCurrentProfile() {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, rol, tenant_id, nombre, tenants(nombre)')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const tenant = profile.tenants as unknown as { nombre: string } | null

  return {
    id:           profile.id,
    rol:          profile.rol,
    tenant_id:    profile.tenant_id,
    nombre:       profile.nombre,
    tenant_nombre: tenant?.nombre ?? null,
  }
}
