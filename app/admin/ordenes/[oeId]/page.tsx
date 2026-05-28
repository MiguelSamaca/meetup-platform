import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import OrdenEjecucionPanel from '@/components/admin/OrdenEjecucionPanel'

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function OrdenEjecucionPage({
  params,
}: {
  params: Promise<{ oeId: string }>
}) {
  const { oeId } = await params
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const [{ data: oe }, { data: oeItems }, { data: oeProveedores }] = await Promise.all([
    supabase
      .from('ordenes_ejecucion')
      .select(`
        id, consecutivo, estado, total_cotizacion, cotizacion_id, contacto_id,
        anticipo_porcentaje, anticipo_monto, anticipo_fecha, anticipo_recibido,
        saldo_fecha, saldo_recibido, notas, created_at, completed_at
      `)
      .eq('id', oeId)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('oe_items')
      .select('id, proveedor, referencia, descripcion, cantidad, estado, fecha_solicitud, fecha_entrega, anticipo_proveedor_pagado, orden')
      .eq('orden_ejecucion_id', oeId)
      .order('orden', { ascending: true }),
    supabase
      .from('oe_proveedores')
      .select('proveedor, monto_orden, anticipo_monto')
      .eq('orden_ejecucion_id', oeId),
  ])

  if (!oe) notFound()

  // Cargar contacto + empresa por separado
  const { data: contacto } = await supabase
    .from('contactos')
    .select('id, nombre, empresa_id')
    .eq('id', oe.contacto_id ?? '')
    .maybeSingle()

  let empresaNombre: string | null = null
  if ((contacto as any)?.empresa_id) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('nombre')
      .eq('id', (contacto as any).empresa_id)
      .maybeSingle()
    empresaNombre = empresa?.nombre ?? null
  }

  const items = ((oeItems ?? []) as Array<{
    id: string; proveedor: string | null; referencia: string | null
    descripcion: string; cantidad: number; estado: string
    fecha_solicitud: string | null; fecha_entrega: string | null
    anticipo_proveedor_pagado: boolean; orden: number
  }>)

  const proveedoresData = (oeProveedores ?? []) as Array<{
    proveedor: string; monto_orden: number; anticipo_monto: number
  }>

  const totalItems   = items.length
  const enBodega     = items.filter(i => i.estado === 'en_bodega').length
  const pctBodega    = totalItems > 0 ? Math.round((enBodega / totalItems) * 100) : 0

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/ordenes" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Órdenes
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{oe.consecutivo}</h1>
        <span className="ml-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
          ● Activa
        </span>
        <div className="ml-auto">
          <Link
            href={`/admin/contactos/${contacto?.id}/cotizaciones/${oe.cotizacion_id}`}
            className="text-sm text-gray-400 hover:text-emerald-600 transition-colors"
          >
            Ver cotización →
          </Link>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Contacto</p>
          <p className="font-semibold text-gray-800">{contacto?.nombre ?? '—'}</p>
          {empresaNombre && <p className="text-xs text-gray-500">{empresaNombre}</p>}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Total cotización</p>
          <p className="text-xl font-bold text-gray-900">${fmt(oe.total_cotizacion ?? 0)}</p>
          <p className="text-xs text-gray-400">Con IVA: ${fmt((oe.total_cotizacion ?? 0) * 1.19)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Anticipo cliente</p>
          <p className="font-semibold text-gray-800">${fmt(oe.anticipo_monto ?? 0)}</p>
          <p className={`text-xs mt-0.5 ${oe.anticipo_recibido ? 'text-emerald-600' : 'text-amber-600'}`}>
            {oe.anticipo_recibido ? '✓ Recibido' : '⏳ Pendiente'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Saldo cliente</p>
          <p className="font-semibold text-gray-800">
            ${fmt((oe.total_cotizacion ?? 0) - (oe.anticipo_monto ?? 0))}
          </p>
          <p className={`text-xs mt-0.5 ${oe.saldo_recibido ? 'text-emerald-600' : 'text-amber-600'}`}>
            {oe.saldo_recibido ? '✓ Recibido' : '⏳ Pendiente'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">En bodega</p>
          <p className="font-bold text-gray-800">{enBodega}/{totalItems}</p>
          <div className="mt-1 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${pctBodega}%` }}
            />
          </div>
        </div>
      </div>

      {/* Panel interactivo */}
      <OrdenEjecucionPanel
        oe={{
          id:                  oe.id,
          estado:              oe.estado,
          total_cotizacion:    oe.total_cotizacion ?? 0,
          anticipo_porcentaje: oe.anticipo_porcentaje ?? 50,
          anticipo_monto:      oe.anticipo_monto ?? 0,
          anticipo_fecha:      (oe as any).anticipo_fecha ?? null,
          anticipo_recibido:   oe.anticipo_recibido,
          saldo_fecha:         (oe as any).saldo_fecha ?? null,
          saldo_recibido:      oe.saldo_recibido,
        }}
        initialItems={items}
        initialProveedores={proveedoresData}
      />
    </div>
  )
}
