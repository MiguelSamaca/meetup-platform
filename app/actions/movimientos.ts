'use server'

import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { logAudit }          from '@/lib/audit'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id) {
    throw new Error('No autorizado')
  }
  return profile
}

/* ─── Cuentas ─────────────────────────────────────────────── */
export async function crearCuenta(formData: FormData) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipo   = (formData.get('tipo') as string) || 'banco'
  const saldo  = Number(formData.get('saldo_inicial') ?? 0)
  if (!nombre) throw new Error('Nombre de cuenta requerido')

  await admin.from('cuentas').insert({
    tenant_id: profile.tenant_id, nombre, tipo, saldo_inicial: saldo,
  })

  await logAudit({
    tenantId: profile.tenant_id, userId: profile.id, userNombre: profile.nombre,
    accion: 'crear_cuenta', entidad: 'cuenta', detalles: { nombre, tipo },
  })

  revalidatePath('/admin/finanzas/movimientos')
}

/* ─── Categorías ──────────────────────────────────────────── */
export async function crearCategoria(formData: FormData) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const nombre = (formData.get('nombre') as string)?.trim()
  const clase  = (formData.get('clase') as string) || 'operacional'
  if (!nombre) throw new Error('Nombre de categoría requerido')

  await admin.from('movimiento_categorias').insert({
    tenant_id: profile.tenant_id, nombre, clase,
  })

  revalidatePath('/admin/finanzas/movimientos')
}

/* ─── Movimientos ─────────────────────────────────────────── */
export interface NuevoMovimiento {
  cuenta_id:     string | null
  fecha:         string
  tipo:          'entrada' | 'salida'
  monto:         number
  concepto:      string
  clasificacion: string
  categoria_id:  string | null
  proyecto_id:   string | null
  recurrente:    boolean
}

export async function crearMovimiento(data: NuevoMovimiento) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  if (!data.monto || data.monto <= 0) throw new Error('El monto debe ser mayor a 0')

  const { error } = await admin.from('movimientos').insert({
    tenant_id:     profile.tenant_id,
    cuenta_id:     data.cuenta_id || null,
    fecha:         data.fecha || new Date().toISOString().slice(0, 10),
    tipo:          data.tipo,
    monto:         data.monto,
    concepto:      data.concepto?.trim() || null,
    clasificacion: data.clasificacion || 'operacional',
    categoria_id:  data.categoria_id || null,
    proyecto_id:   data.proyecto_id || null,
    recurrente:    data.recurrente ?? false,
    created_by:    profile.id,
  })
  if (error) throw new Error(error.message)

  await logAudit({
    tenantId: profile.tenant_id, userId: profile.id, userNombre: profile.nombre,
    accion: 'registrar_movimiento', entidad: 'movimiento',
    detalles: {
      tipo: data.tipo, monto: data.monto,
      clasificacion: data.clasificacion,
      recurrente: data.recurrente ? 'sí' : 'no',
    },
  })

  revalidatePath('/admin/finanzas/movimientos')
  revalidatePath('/admin/finanzas')
  revalidatePath('/admin/finanzas/flujo')
}

export async function eliminarMovimiento(id: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin.from('movimientos').delete().eq('id', id).eq('tenant_id', profile.tenant_id!)

  await logAudit({
    tenantId: profile.tenant_id, userId: profile.id, userNombre: profile.nombre,
    accion: 'eliminar_movimiento', entidad: 'movimiento', entidadId: id,
  })

  revalidatePath('/admin/finanzas/movimientos')
  revalidatePath('/admin/finanzas')
  revalidatePath('/admin/finanzas/flujo')
}
