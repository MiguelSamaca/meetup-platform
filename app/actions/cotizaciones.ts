'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

/**
 * Sincroniza los ítems de una cotización al catálogo de productos.
 * Solo inserta productos nuevos — nunca modifica los ya existentes.
 * Identifica duplicados por referencia (si existe) o por descripción.
 */
async function sincronizarCatalogo(tenantId: string, items: ItemInput[]) {
  if (!items.length) return
  const admin = createAdminClient()

  // Separar ítems con y sin referencia
  const conRef   = items.filter(it => it.referencia?.trim())
  const sinRef   = items.filter(it => !it.referencia?.trim())

  // Buscar productos ya existentes para no duplicar
  const referencias   = conRef.map(it => it.referencia.trim())
  const descripciones = sinRef.map(it => it.descripcion.trim())

  const [{ data: existentesPorRef }, { data: existentesPorDesc }] = await Promise.all([
    referencias.length
      ? admin.from('productos').select('referencia').eq('tenant_id', tenantId).in('referencia', referencias)
      : Promise.resolve({ data: [] }),
    descripciones.length
      ? admin.from('productos').select('descripcion').eq('tenant_id', tenantId).in('descripcion', descripciones)
      : Promise.resolve({ data: [] }),
  ])

  const refsExistentes  = new Set((existentesPorRef  ?? []).map((p: any) => p.referencia))
  const descsExistentes = new Set((existentesPorDesc ?? []).map((p: any) => p.descripcion))

  // Filtrar solo los que no existen aún
  const nuevos = [
    ...conRef.filter(it => !refsExistentes.has(it.referencia.trim())),
    ...sinRef.filter(it => !descsExistentes.has(it.descripcion.trim())),
  ]

  if (!nuevos.length) return

  await admin.from('productos').insert(
    nuevos.map(it => ({
      tenant_id:   tenantId,
      referencia:  it.referencia?.trim() || null,
      proveedor:   it.proveedor?.trim()  || null,
      descripcion: it.descripcion.trim(),
      foto_url:    it.foto_url || null,
      unidad:      'und',
      activo:      true,
    }))
  )

  revalidatePath('/admin/productos')
}

export interface ItemInput {
  referencia:      string
  proveedor:       string
  descripcion:     string
  cantidad:        number
  precio_unitario: number
  descuento:       number
  moneda_costo:    'COP' | 'USD'
  costo_unitario:  number
  trm:             number | null
  orden:           number
  foto_url:        string | null
}

export async function crearCotizacion(
  contactoId:              string,
  estado:                  string,
  notas:                   string,
  items:                   ItemInput[],
  fecha:                   string,
  validez_dias:            number,
  mostrar_descuento:       boolean = true,
  mostrar_descuento_total: boolean = true,
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const { data: contacto } = await admin
    .from('contactos')
    .select('id, nombre')
    .eq('id', contactoId)
    .eq('tenant_id', profile.tenant_id!)
    .single()

  if (!contacto) throw new Error('Contacto no encontrado')

  // Consecutivo COT-YYYYMM-NNN
  const { count } = await admin
    .from('cotizaciones')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id!)

  const now         = new Date()
  const yyyymm      = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const consecutivo = `COT-${yyyymm}-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data: cot, error: cotError } = await admin
    .from('cotizaciones')
    .insert({
      tenant_id:         profile.tenant_id,
      contacto_id:       contactoId,
      consecutivo,
      estado,
      notas:                   notas || null,
      fecha:                   fecha || new Date().toISOString().split('T')[0],
      validez_dias:            validez_dias || 30,
      mostrar_descuento,
      mostrar_descuento_total,
    })
    .select('id')
    .single()

  if (cotError || !cot) throw new Error(cotError?.message ?? 'Error creando cotización')

  if (items.length > 0) {
    const { error: itemsError } = await admin
      .from('cotizacion_items')
      .insert(items.map((it, i) => ({
        cotizacion_id:   cot.id,
        referencia:      it.referencia || null,
        proveedor:       it.proveedor  || null,
        descripcion:     it.descripcion,
        cantidad:        it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento:       it.descuento ?? 0,
        moneda_costo:    it.moneda_costo,
        costo_unitario:  it.costo_unitario,
        trm:             it.moneda_costo === 'USD' ? it.trm : null,
        orden:           it.orden ?? i,
        foto_url:        it.foto_url || null,
      })))

    if (itemsError) throw new Error(itemsError.message)
  }

  // Auto-sync al catálogo de productos
  await sincronizarCatalogo(profile.tenant_id!, items)

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'crear_cotizacion',
    entidad:    'cotizacion',
    entidadId:  cot.id,
    detalles:   { consecutivo, contacto: contacto.nombre, estado, items: items.length },
  })

  revalidatePath(`/admin/contactos/${contactoId}`)
  revalidatePath('/admin/cotizaciones')
  redirect(`/admin/contactos/${contactoId}`)
}

export async function editarCotizacion(
  cotizacionId:            string,
  contactoId:              string,
  estado:                  string,
  notas:                   string,
  items:                   ItemInput[],
  fecha:                   string,
  validez_dias:            number,
  mostrar_descuento:       boolean = true,
  mostrar_descuento_total: boolean = true,
) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  // Verify ownership
  const { data: cot } = await admin
    .from('cotizaciones')
    .select('id')
    .eq('id', cotizacionId)
    .eq('tenant_id', profile.tenant_id!)
    .single()

  if (!cot) throw new Error('Cotización no encontrada')

  // Update header
  const { error: updError } = await admin
    .from('cotizaciones')
    .update({
      estado,
      notas:                   notas || null,
      fecha:                   fecha || new Date().toISOString().split('T')[0],
      validez_dias:            validez_dias || 30,
      mostrar_descuento,
      mostrar_descuento_total,
    })
    .eq('id', cotizacionId)
    .eq('tenant_id', profile.tenant_id!)

  if (updError) throw new Error(updError.message)

  // Replace all items
  await admin.from('cotizacion_items').delete().eq('cotizacion_id', cotizacionId)

  if (items.length > 0) {
    const { error: itemsError } = await admin
      .from('cotizacion_items')
      .insert(items.map((it, i) => ({
        cotizacion_id:   cotizacionId,
        referencia:      it.referencia || null,
        proveedor:       it.proveedor  || null,
        descripcion:     it.descripcion,
        cantidad:        it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento:       it.descuento ?? 0,
        moneda_costo:    it.moneda_costo,
        costo_unitario:  it.costo_unitario,
        trm:             it.moneda_costo === 'USD' ? it.trm : null,
        orden:           it.orden ?? i,
        foto_url:        it.foto_url || null,
      })))

    if (itemsError) throw new Error(itemsError.message)
  }

  // Auto-sync al catálogo de productos
  await sincronizarCatalogo(profile.tenant_id!, items)

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'editar_cotizacion',
    entidad:    'cotizacion',
    entidadId:  cotizacionId,
    detalles:   { estado, items: items.length },
  })

  revalidatePath(`/admin/contactos/${contactoId}`)
  revalidatePath(`/admin/contactos/${contactoId}/cotizaciones/${cotizacionId}`)
  revalidatePath('/admin/cotizaciones')
  redirect(`/admin/contactos/${contactoId}/cotizaciones/${cotizacionId}`)
}

export async function eliminarCotizacion(id: string, contactoId: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const { error } = await admin
    .from('cotizaciones')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/contactos/${contactoId}`)
  redirect(`/admin/contactos/${contactoId}`)
}

export async function duplicarCotizacion(cotizacionId: string, contactoId: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  // 1. Leer la cotización original con todos sus ítems
  const { data: original } = await admin
    .from('cotizaciones')
    .select(`
      contacto_id, notas, validez_dias, mostrar_descuento,
      cotizacion_items(
        referencia, proveedor, descripcion, cantidad,
        precio_unitario, descuento, moneda_costo,
        costo_unitario, trm, orden, foto_url
      )
    `)
    .eq('id', cotizacionId)
    .eq('tenant_id', profile.tenant_id!)
    .single()

  if (!original) throw new Error('Cotización no encontrada')

  // 2. Generar nuevo consecutivo
  const { count } = await admin
    .from('cotizaciones')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id!)

  const now         = new Date()
  const yyyymm      = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const consecutivo = `COT-${yyyymm}-${String((count ?? 0) + 1).padStart(3, '0')}`

  // 3. Insertar nueva cotización (borrador, fecha hoy)
  const { data: nueva, error: cotError } = await admin
    .from('cotizaciones')
    .insert({
      tenant_id:         profile.tenant_id,
      contacto_id:       original.contacto_id,
      consecutivo,
      estado:            'borrador',
      notas:             original.notas ?? null,
      fecha:             now.toISOString().split('T')[0],
      validez_dias:      original.validez_dias ?? 30,
      mostrar_descuento: original.mostrar_descuento ?? true,
    })
    .select('id')
    .single()

  if (cotError || !nueva) throw new Error(cotError?.message ?? 'Error duplicando cotización')

  // 4. Copiar todos los ítems
  const items = (original.cotizacion_items ?? []) as Array<{
    referencia: string | null; proveedor: string | null; descripcion: string
    cantidad: number; precio_unitario: number; descuento: number
    moneda_costo: string; costo_unitario: number; trm: number | null
    orden: number; foto_url: string | null
  }>

  if (items.length > 0) {
    const { error: itemsError } = await admin
      .from('cotizacion_items')
      .insert(items.map(it => ({
        cotizacion_id:   nueva.id,
        referencia:      it.referencia,
        proveedor:       it.proveedor,
        descripcion:     it.descripcion,
        cantidad:        it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento:       it.descuento ?? 0,
        moneda_costo:    it.moneda_costo,
        costo_unitario:  it.costo_unitario,
        trm:             it.trm,
        orden:           it.orden,
        foto_url:        it.foto_url,
      })))

    if (itemsError) throw new Error(itemsError.message)
  }

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'crear_cotizacion',
    entidad:    'cotizacion',
    entidadId:  nueva.id,
    detalles:   { consecutivo, duplicada_de: cotizacionId, items: items.length },
  })

  revalidatePath(`/admin/contactos/${contactoId}`)
  revalidatePath('/admin/cotizaciones')
  // Redirigir al editar para que el usuario ajuste la copia
  redirect(`/admin/contactos/${contactoId}/cotizaciones/${nueva.id}/editar`)
}
