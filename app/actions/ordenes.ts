'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
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

/* ─────────────────────────────────────────────────────────────
   Crear OE desde cotización aprobada
───────────────────────────────────────────────────────────── */
export async function crearOrdenEjecucion(cotizacionId: string, contactoId: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  // ¿Ya existe una OE para esta cotización?
  const { data: existing } = await admin
    .from('ordenes_ejecucion')
    .select('id')
    .eq('cotizacion_id', cotizacionId)
    .eq('tenant_id', profile.tenant_id!)
    .maybeSingle()

  if (existing) redirect(`/admin/ordenes/${existing.id}`)

  // Verificar que la cotización pertenece al tenant
  const { data: cot } = await admin
    .from('cotizaciones')
    .select('id')
    .eq('id', cotizacionId)
    .eq('tenant_id', profile.tenant_id!)
    .maybeSingle()

  if (!cot) throw new Error('Cotización no encontrada')

  // Leer ítems ordenados explícitamente — evita orden arbitrario de PostgREST
  const { data: cotItems } = await admin
    .from('cotizacion_items')
    .select('referencia, proveedor, descripcion, cantidad, precio_unitario, descuento, costo_unitario, moneda_costo, trm, orden')
    .eq('cotizacion_id', cotizacionId)
    .order('orden', { ascending: true })

  const items = (cotItems ?? []) as Array<{
    referencia: string | null; proveedor: string | null; descripcion: string
    cantidad: number; precio_unitario: number; descuento: number
    costo_unitario: number; moneda_costo: string; trm: number | null
    orden: number
  }>

  // Total neto de venta (con descuentos) — SIN IVA
  const totalCotizacion = Math.round(
    items.reduce((sum, it) => {
      const bruto = it.cantidad * it.precio_unitario
      return sum + bruto * (1 - (it.descuento ?? 0) / 100)
    }, 0)
  )
  // Total que el cliente realmente paga (CON IVA 19%)
  const totalConIva = Math.round(totalCotizacion * 1.19)

  // Consecutivo OE-YYYYMM-NNN
  const { count } = await admin
    .from('ordenes_ejecucion')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id!)

  const now         = new Date()
  const yyyymm      = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const consecutivo = `OE-${yyyymm}-${String((count ?? 0) + 1).padStart(3, '0')}`

  const anticipo_porcentaje = 50
  const anticipo_monto      = Math.round(totalCotizacion * anticipo_porcentaje / 100)

  const { data: oe, error } = await admin
    .from('ordenes_ejecucion')
    .insert({
      tenant_id:           profile.tenant_id,
      cotizacion_id:       cotizacionId,
      contacto_id:         contactoId,
      consecutivo,
      estado:              'activa',
      total_cotizacion:    totalCotizacion,
      total_con_iva:       totalConIva,
      anticipo_porcentaje,
      anticipo_monto,
    })
    .select('id')
    .single()

  if (error || !oe) throw new Error(error?.message ?? 'Error creando orden')

  if (items.length > 0) {
    await admin.from('oe_items').insert(
      items.map(it => ({
        orden_ejecucion_id: oe.id,
        proveedor:          it.proveedor  ?? null,
        referencia:         it.referencia ?? null,
        descripcion:        it.descripcion,
        cantidad:           it.cantidad,
        precio_unitario:    it.precio_unitario  ?? 0,
        descuento:          it.descuento        ?? 0,
        costo_unitario:     it.costo_unitario   ?? 0,
        moneda_costo:       it.moneda_costo     ?? 'COP',
        trm:                it.trm              ?? null,
        estado:             'pendiente',
        orden:              it.orden ?? 0,
      }))
    )
  }

  // Auto-crear registros de oe_proveedores con la suma de costos
  const provCostMap = new Map<string, number>()
  for (const it of items) {
    if (!it.proveedor) continue
    const costoCOP = it.moneda_costo === 'USD'
      ? it.costo_unitario * (it.trm ?? 1)
      : it.costo_unitario
    provCostMap.set(
      it.proveedor,
      (provCostMap.get(it.proveedor) ?? 0) + it.cantidad * costoCOP
    )
  }
  if (provCostMap.size > 0) {
    await admin.from('oe_proveedores').insert(
      Array.from(provCostMap.entries()).map(([proveedor, monto_orden]) => ({
        orden_ejecucion_id: oe.id,
        proveedor,
        monto_orden:   Math.round(monto_orden),
        anticipo_monto: 0,
      }))
    )
  }

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'crear_orden_ejecucion',
    entidad:    'orden_ejecucion',
    entidadId:  oe.id,
    detalles:   { consecutivo, cotizacion_id: cotizacionId, items: items.length },
  })

  revalidatePath(`/admin/contactos/${contactoId}`)
  revalidatePath('/admin/ordenes')
  redirect(`/admin/ordenes/${oe.id}`)
}

/* ─────────────────────────────────────────────────────────────
   Actualizar datos de anticipo del cliente
───────────────────────────────────────────────────────────── */
export async function actualizarAnticipo(
  oeId: string,
  data: {
    anticipo_porcentaje?: number
    anticipo_monto?:      number
    anticipo_fecha?:      string | null
    anticipo_recibido?:   boolean
  }
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('ordenes_ejecucion')
    .update(data)
    .eq('id', oeId)
    .eq('tenant_id', profile.tenant_id!)

  revalidatePath(`/admin/ordenes/${oeId}`)
  revalidatePath('/admin/finanzas/cobrar')
  revalidatePath('/admin/finanzas')
}

/* ─────────────────────────────────────────────────────────────
   Actualizar saldo del cliente
───────────────────────────────────────────────────────────── */
export async function actualizarSaldo(
  oeId: string,
  data: { saldo_fecha?: string | null; saldo_recibido?: boolean }
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('ordenes_ejecucion')
    .update(data)
    .eq('id', oeId)
    .eq('tenant_id', profile.tenant_id!)

  revalidatePath(`/admin/ordenes/${oeId}`)
  revalidatePath('/admin/finanzas/cobrar')
  revalidatePath('/admin/finanzas')
}

/* ─────────────────────────────────────────────────────────────
   Actualizar estado de un ítem (pendiente / pedido / recibido)
───────────────────────────────────────────────────────────── */
export async function actualizarItemEstado(
  oeId:   string,
  itemId: string,
  estado: 'pendiente' | 'pedido' | 'en_bodega',
  eta?:   string | null
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('oe_items')
    .update({ estado, ...(eta !== undefined ? { eta: eta || null } : {}) })
    .eq('id', itemId)
    .eq('orden_ejecucion_id', oeId)

  revalidatePath(`/admin/ordenes/${oeId}`)
}

/* ─────────────────────────────────────────────────────────────
   Marcar/desmarcar anticipo del proveedor (por grupo)
───────────────────────────────────────────────────────────── */
export async function actualizarAnticipoProv(
  oeId:      string,
  proveedor: string | null,
  pagado:    boolean
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  let query = admin
    .from('oe_items')
    .update({ anticipo_proveedor_pagado: pagado })
    .eq('orden_ejecucion_id', oeId)

  if (proveedor === null) {
    query = (query as any).is('proveedor', null)
  } else {
    query = (query as any).eq('proveedor', proveedor)
  }

  await query
  revalidatePath(`/admin/ordenes/${oeId}`)
  revalidatePath('/admin/finanzas/pagar')
  revalidatePath('/admin/finanzas')
}

/* ─────────────────────────────────────────────────────────────
   Actualizar fechas de un ítem (solicitud y entrega)
───────────────────────────────────────────────────────────── */
export async function actualizarItemFechas(
  oeId:            string,
  itemId:          string,
  fecha_solicitud: string | null,
  fecha_entrega:   string | null
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('oe_items')
    .update({
      fecha_solicitud: fecha_solicitud || null,
      fecha_entrega:   fecha_entrega   || null,
    })
    .eq('id', itemId)
    .eq('orden_ejecucion_id', oeId)

  revalidatePath(`/admin/ordenes/${oeId}`)
}

/* ─────────────────────────────────────────────────────────────
   Reordenar ítems (guardar nueva secuencia de orden)
───────────────────────────────────────────────────────────── */
export async function reordenarItems(oeId: string, orderedIds: string[]) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await Promise.all(
    orderedIds.map((id, idx) =>
      admin
        .from('oe_items')
        .update({ orden: idx })
        .eq('id', id)
        .eq('orden_ejecucion_id', oeId)
    )
  )

  revalidatePath(`/admin/ordenes/${oeId}`)
}

/* ─────────────────────────────────────────────────────────────
   Actualizar montos financieros por proveedor
───────────────────────────────────────────────────────────── */
export async function actualizarProveedorMontos(
  oeId:          string,
  proveedor:     string,
  monto_orden:   number,
  anticipo_monto: number
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('oe_proveedores')
    .upsert(
      { orden_ejecucion_id: oeId, proveedor, monto_orden, anticipo_monto },
      { onConflict: 'orden_ejecucion_id,proveedor' }
    )

  revalidatePath(`/admin/ordenes/${oeId}`)
}

/* ─────────────────────────────────────────────────────────────
   Completar / reabrir orden
───────────────────────────────────────────────────────────── */
export async function completarOrden(oeId: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('ordenes_ejecucion')
    .update({ estado: 'completada', completed_at: new Date().toISOString() })
    .eq('id', oeId)
    .eq('tenant_id', profile.tenant_id!)

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'completar_orden_ejecucion',
    entidad:    'orden_ejecucion',
    entidadId:  oeId,
    detalles:   {},
  })

  revalidatePath(`/admin/ordenes/${oeId}`)
  revalidatePath('/admin/ordenes')
}

export async function reabrirOrden(oeId: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await admin
    .from('ordenes_ejecucion')
    .update({ estado: 'activa', completed_at: null })
    .eq('id', oeId)
    .eq('tenant_id', profile.tenant_id!)

  revalidatePath(`/admin/ordenes/${oeId}`)
  revalidatePath('/admin/ordenes')
}
