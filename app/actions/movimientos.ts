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

export async function editarCuenta(id: string, formData: FormData) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipo   = (formData.get('tipo') as string) || 'banco'
  const saldo  = Number(formData.get('saldo_inicial') ?? 0)
  if (!nombre) throw new Error('Nombre de cuenta requerido')

  await admin.from('cuentas')
    .update({ nombre, tipo, saldo_inicial: saldo })
    .eq('id', id).eq('tenant_id', profile.tenant_id!)

  revalidatePath('/admin/finanzas/movimientos')
}

export async function eliminarCuenta(id: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  // Los movimientos asociados quedan con cuenta_id = null (FK ON DELETE SET NULL)
  await admin.from('cuentas').delete().eq('id', id).eq('tenant_id', profile.tenant_id!)

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
  cuenta_id:          string | null
  fecha:              string
  tipo:               'entrada' | 'salida'
  monto:              number
  concepto:           string
  clasificacion:      string
  categoria_id:       string | null
  proyecto_id:        string | null
  orden_ejecucion_id?: string | null   // venta directa (sin proyecto)
  recurrente:         boolean
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
    orden_ejecucion_id: data.orden_ejecucion_id || null,
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

export async function editarMovimiento(id: string, data: NuevoMovimiento) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  if (!data.monto || data.monto <= 0) throw new Error('El monto debe ser mayor a 0')

  const { error } = await admin.from('movimientos').update({
    cuenta_id:     data.cuenta_id || null,
    fecha:         data.fecha,
    tipo:          data.tipo,
    monto:         data.monto,
    concepto:      data.concepto?.trim() || null,
    clasificacion: data.clasificacion || 'operacional',
    categoria_id:  data.categoria_id || null,
    proyecto_id:   data.proyecto_id || null,
    orden_ejecucion_id: data.orden_ejecucion_id || null,
    recurrente:    data.recurrente ?? false,
  }).eq('id', id).eq('tenant_id', profile.tenant_id!)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/finanzas/movimientos')
  revalidatePath('/admin/finanzas')
  revalidatePath('/admin/finanzas/flujo')
}

export async function eliminarMovimiento(id: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  // Si es una pata de un traspaso, borrar ambas para no descuadrar las cuentas
  const { data: mv } = await admin
    .from('movimientos').select('transferencia_id')
    .eq('id', id).eq('tenant_id', profile.tenant_id!).maybeSingle()

  if (mv?.transferencia_id) {
    await admin.from('movimientos').delete()
      .eq('transferencia_id', mv.transferencia_id).eq('tenant_id', profile.tenant_id!)
  } else {
    await admin.from('movimientos').delete().eq('id', id).eq('tenant_id', profile.tenant_id!)
  }

  await logAudit({
    tenantId: profile.tenant_id, userId: profile.id, userNombre: profile.nombre,
    accion: 'eliminar_movimiento', entidad: 'movimiento', entidadId: id,
  })

  revalidatePath('/admin/finanzas/movimientos')
  revalidatePath('/admin/finanzas')
  revalidatePath('/admin/finanzas/flujo')
}

/* ─── Traspaso entre cuentas ──────────────────────────────── */
export async function crearTraspaso(input: {
  origenId:  string
  destinoId: string
  monto:     number
  fecha:     string
  concepto?: string
}) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  if (!input.monto || input.monto <= 0) throw new Error('El monto debe ser mayor a 0')
  if (!input.origenId || !input.destinoId) throw new Error('Selecciona ambas cuentas')
  if (input.origenId === input.destinoId) throw new Error('Las cuentas deben ser distintas')

  const { data: ctas } = await admin
    .from('cuentas').select('id, nombre')
    .eq('tenant_id', profile.tenant_id!).in('id', [input.origenId, input.destinoId])
  const nombre = new Map((ctas ?? []).map(c => [c.id, c.nombre]))

  const transferencia_id = crypto.randomUUID()
  const fecha = input.fecha || new Date().toISOString().slice(0, 10)
  const nota  = input.concepto?.trim()
  const base  = {
    tenant_id: profile.tenant_id, fecha, clasificacion: 'traspaso',
    transferencia_id, recurrente: false, created_by: profile.id,
  }

  const { error } = await admin.from('movimientos').insert([
    { ...base, cuenta_id: input.origenId,  tipo: 'salida',  monto: input.monto,
      concepto: nota || `Traspaso a ${nombre.get(input.destinoId) ?? 'cuenta'}` },
    { ...base, cuenta_id: input.destinoId, tipo: 'entrada', monto: input.monto,
      concepto: nota || `Traspaso de ${nombre.get(input.origenId) ?? 'cuenta'}` },
  ])
  if (error) throw new Error(error.message)

  await logAudit({
    tenantId: profile.tenant_id, userId: profile.id, userNombre: profile.nombre,
    accion: 'registrar_traspaso', entidad: 'movimiento',
    detalles: { de: nombre.get(input.origenId), a: nombre.get(input.destinoId), monto: input.monto },
  })

  revalidatePath('/admin/finanzas/movimientos')
  revalidatePath('/admin/finanzas')
  revalidatePath('/admin/finanzas/flujo')
}
