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

/* ─── Importar movimientos ya realizados (cobros / gastos de proyectos) ─── */
export async function importarMovimientosExistentes(): Promise<{ importados: number }> {
  const profile = await requireAdmin()
  const admin   = createAdminClient()
  const tid     = profile.tenant_id!
  const hoy     = new Date().toISOString().slice(0, 10)

  // Lo ya importado (para no duplicar)
  const { data: yaImport } = await admin
    .from('movimientos').select('origen, origen_ref')
    .eq('tenant_id', tid).not('origen', 'is', null)
  const existe = new Set((yaImport ?? []).map(m => `${m.origen}:${m.origen_ref}`))

  // Proyecto asociado a cada OE
  const { data: proyectos } = await admin
    .from('proyectos').select('id, orden_ejecucion_id').eq('tenant_id', tid)
  const proyPorOE = new Map<string, string>()
  for (const p of proyectos ?? []) {
    if ((p as { orden_ejecucion_id?: string }).orden_ejecucion_id) {
      proyPorOE.set((p as { orden_ejecucion_id: string }).orden_ejecucion_id, p.id)
    }
  }

  const nuevos: Record<string, unknown>[] = []

  // Cobros recibidos (anticipos y saldos)
  const { data: oes } = await admin
    .from('ordenes_ejecucion')
    .select('id, consecutivo, total_cotizacion, total_con_iva, anticipo_porcentaje, anticipo_recibido, anticipo_fecha, saldo_recibido, saldo_fecha')
    .eq('tenant_id', tid)

  for (const oe of oes ?? []) {
    const totalIva = oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19)
    const antic    = Math.round(totalIva * (oe.anticipo_porcentaje ?? 50) / 100)
    const saldo    = Math.max(0, totalIva - antic)
    const proyId   = proyPorOE.get(oe.id) ?? null

    if (oe.anticipo_recibido && antic > 0 && !existe.has(`oe_anticipo:${oe.id}`)) {
      nuevos.push({
        tenant_id: tid, tipo: 'entrada', monto: antic, fecha: oe.anticipo_fecha ?? hoy,
        concepto: `Anticipo — ${oe.consecutivo}`, clasificacion: proyId ? 'proyecto' : 'operacional',
        proyecto_id: proyId, origen: 'oe_anticipo', origen_ref: oe.id, created_by: profile.id,
      })
    }
    if (oe.saldo_recibido && saldo > 0 && !existe.has(`oe_saldo:${oe.id}`)) {
      nuevos.push({
        tenant_id: tid, tipo: 'entrada', monto: saldo, fecha: oe.saldo_fecha ?? hoy,
        concepto: `Saldo — ${oe.consecutivo}`, clasificacion: proyId ? 'proyecto' : 'operacional',
        proyecto_id: proyId, origen: 'oe_saldo', origen_ref: oe.id, created_by: profile.id,
      })
    }
  }

  // Gastos de proyecto ya registrados
  const { data: gastos } = await admin
    .from('gastos').select('id, descripcion, monto, fecha, proyecto_id').eq('tenant_id', tid)
  for (const g of gastos ?? []) {
    if ((g.monto ?? 0) <= 0 || existe.has(`gasto:${g.id}`)) continue
    nuevos.push({
      tenant_id: tid, tipo: 'salida', monto: g.monto, fecha: g.fecha ?? hoy,
      concepto: `Gasto — ${g.descripcion ?? 'proyecto'}`,
      clasificacion: g.proyecto_id ? 'proyecto' : 'operacional',
      proyecto_id: g.proyecto_id ?? null, origen: 'gasto', origen_ref: g.id, created_by: profile.id,
    })
  }

  // Anticipos a proveedores ya pagados (sin fecha real → hoy, se ajusta luego)
  const oeIds = (oes ?? []).map(o => o.id)
  if (oeIds.length > 0) {
    const [{ data: proveedores }, { data: items }] = await Promise.all([
      admin.from('oe_proveedores').select('orden_ejecucion_id, proveedor, anticipo_monto').in('orden_ejecucion_id', oeIds),
      admin.from('oe_items').select('orden_ejecucion_id, proveedor, anticipo_proveedor_pagado').in('orden_ejecucion_id', oeIds),
    ])
    for (const prov of proveedores ?? []) {
      const provItems = (items ?? []).filter(
        i => i.orden_ejecucion_id === prov.orden_ejecucion_id && i.proveedor === prov.proveedor
      )
      const pagado = provItems.length > 0 && provItems.every(i => i.anticipo_proveedor_pagado)
      const monto  = prov.anticipo_monto ?? 0
      const ref    = `${prov.orden_ejecucion_id}:${prov.proveedor}`
      if (pagado && monto > 0 && !existe.has(`prov_anticipo:${ref}`)) {
        const proyId = proyPorOE.get(prov.orden_ejecucion_id) ?? null
        nuevos.push({
          tenant_id: tid, tipo: 'salida', monto, fecha: hoy,
          concepto: `Anticipo prov. — ${prov.proveedor ?? 'proveedor'}`,
          clasificacion: proyId ? 'proyecto' : 'operacional',
          proyecto_id: proyId, origen: 'prov_anticipo', origen_ref: ref, created_by: profile.id,
        })
      }
    }
  }

  if (nuevos.length > 0) {
    const { error } = await admin.from('movimientos').insert(nuevos)
    if (error) throw new Error(error.message)
  }

  await logAudit({
    tenantId: tid, userId: profile.id, userNombre: profile.nombre,
    accion: 'registrar_movimiento', entidad: 'movimiento',
    detalles: { importacion: 'sí', importados: nuevos.length },
  })

  revalidatePath('/admin/finanzas/movimientos')
  return { importados: nuevos.length }
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

  await admin.from('movimientos').delete().eq('id', id).eq('tenant_id', profile.tenant_id!)

  await logAudit({
    tenantId: profile.tenant_id, userId: profile.id, userNombre: profile.nombre,
    accion: 'eliminar_movimiento', entidad: 'movimiento', entidadId: id,
  })

  revalidatePath('/admin/finanzas/movimientos')
  revalidatePath('/admin/finanzas')
  revalidatePath('/admin/finanzas/flujo')
}
