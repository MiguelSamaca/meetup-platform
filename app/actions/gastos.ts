'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id) {
    throw new Error('No autorizado')
  }
  return profile
}

export async function agregarGasto(
  proyectoId: string,
  data: {
    descripcion: string
    categoria:   string
    monto:       number
    factura:     string
    soporte_url: string
    fecha:       string
  }
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const { error } = await admin
    .from('gastos')
    .insert({
      tenant_id:   profile.tenant_id,
      proyecto_id: proyectoId,
      descripcion: data.descripcion,
      categoria:   data.categoria,
      monto:       data.monto,
      factura:     data.factura  || null,
      soporte_url: data.soporte_url || null,
      fecha:       data.fecha    || null,
    })

  if (error) throw new Error(error.message)

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'registrar_gasto',
    entidad:    'gasto',
    entidadId:  proyectoId,
    detalles:   { categoria: data.categoria, monto: data.monto, descripcion: data.descripcion },
  })

  revalidatePath(`/admin/proyectos/${proyectoId}`)
}

export async function eliminarGasto(gastoId: string, proyectoId: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('gastos')
    .delete()
    .eq('id', gastoId)
    .eq('tenant_id', profile.tenant_id!)

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'eliminar_gasto',
    entidad:    'gasto',
    entidadId:  gastoId,
    detalles:   { proyecto: proyectoId },
  })

  revalidatePath(`/admin/proyectos/${proyectoId}`)
}
