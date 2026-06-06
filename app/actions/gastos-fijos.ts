'use server'

import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id)
    throw new Error('No autorizado')
  return profile
}

/* ─── Crear gasto fijo ─── */
export async function crearGastoFijo(formData: FormData) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin.from('gastos_fijos').insert({
    tenant_id: profile.tenant_id,
    nombre:    (formData.get('nombre')    as string).trim(),
    monto:     Number(formData.get('monto')),
    categoria: formData.get('categoria') as string,
  })

  revalidatePath('/admin/finanzas/gastos-fijos')
  revalidatePath('/admin/finanzas/flujo')
  revalidatePath('/admin/finanzas')
}

/* ─── Activar / desactivar ─── */
export async function toggleGastoFijo(id: string, activo: boolean) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('gastos_fijos')
    .update({ activo })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  revalidatePath('/admin/finanzas/gastos-fijos')
  revalidatePath('/admin/finanzas/flujo')
  revalidatePath('/admin/finanzas')
}

/* ─── Eliminar ─── */
export async function eliminarGastoFijo(id: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('gastos_fijos')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  revalidatePath('/admin/finanzas/gastos-fijos')
  revalidatePath('/admin/finanzas/flujo')
  revalidatePath('/admin/finanzas')
}

/* ─── Actualizar saldo actual en caja ─── */
export async function actualizarSaldoCaja(monto: number) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('tenant_config')
    .update({ saldo_caja_actual: monto })
    .eq('tenant_id', profile.tenant_id!)

  revalidatePath('/admin/finanzas/flujo')
  revalidatePath('/admin/finanzas')
}
