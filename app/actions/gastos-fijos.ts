'use server'

import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { logAudit }          from '@/lib/audit'

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

  const nombre = (formData.get('nombre') as string).trim()
  const monto  = Number(formData.get('monto'))
  await admin.from('gastos_fijos').insert({
    tenant_id: profile.tenant_id,
    nombre,
    monto,
    categoria: formData.get('categoria') as string,
  })

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'crear_gasto_fijo',
    entidad:    'gasto_fijo',
    detalles:   { nombre, monto },
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

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'editar_gasto_fijo',
    entidad:    'gasto_fijo',
    entidadId:  id,
    detalles:   { activo },
  })

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

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'eliminar_gasto_fijo',
    entidad:    'gasto_fijo',
    entidadId:  id,
  })

  revalidatePath('/admin/finanzas/gastos-fijos')
  revalidatePath('/admin/finanzas/flujo')
  revalidatePath('/admin/finanzas')
}
