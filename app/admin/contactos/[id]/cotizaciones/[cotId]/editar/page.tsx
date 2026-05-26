import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CotizacionForm from '@/components/admin/CotizacionForm'

export default async function EditarCotizacionPage({
  params,
}: {
  params: Promise<{ id: string; cotId: string }>
}) {
  const { id, cotId } = await params
  const profile       = await getCurrentProfile()
  const supabase      = createAdminClient()

  const [{ data: contacto }, { data: cot }, { data: catalogo }] = await Promise.all([
    supabase
      .from('contactos')
      .select('id, nombre, email, empresas(nombre)')
      .eq('id', id)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('cotizaciones')
      .select(`
        id, consecutivo, estado, notas, fecha, validez_dias, mostrar_descuento, mostrar_descuento_total,
        cotizacion_items(id, referencia, proveedor, descripcion, cantidad, precio_unitario,
          descuento, moneda_costo, costo_unitario, trm, foto_url, orden)
      `)
      .eq('id', cotId)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('productos')
      .select('id, referencia, proveedor, descripcion, unidad, foto_url')
      .eq('tenant_id', profile?.tenant_id!)
      .eq('activo', true)
      .order('descripcion'),
  ])

  if (!contacto || !cot) notFound()

  const empresaNombre = (contacto.empresas as unknown as { nombre: string } | null)?.nombre

  const items = ((cot.cotizacion_items ?? []) as Array<{
    id: string; referencia: string | null; proveedor: string | null; descripcion: string
    cantidad: number; precio_unitario: number; descuento: number
    moneda_costo: 'COP' | 'USD'; costo_unitario: number
    trm: number | null; foto_url: string | null; orden: number
  }>).sort((a, b) => a.orden - b.orden)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/contactos/${id}/cotizaciones/${cotId}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← {cot.consecutivo}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar cotización</h1>
      </div>

      {/* Info del contacto */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Contacto</p>
          <p className="font-semibold text-gray-800">{contacto.nombre}</p>
        </div>
        {empresaNombre && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Empresa</p>
            <p className="text-gray-700">{empresaNombre}</p>
          </div>
        )}
        {contacto.email && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Correo</p>
            <p className="text-gray-700">{contacto.email}</p>
          </div>
        )}
        <div className="ml-auto">
          <span className="text-xs font-mono text-gray-400">{cot.consecutivo}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CotizacionForm
          contactoId={id}
          contactoNombre={contacto.nombre}
          catalogo={catalogo ?? []}
          cotizacionId={cotId}
          initialEstado={cot.estado}
          initialNotas={cot.notas ?? ''}
          initialFecha={cot.fecha ?? undefined}
          initialValidez={cot.validez_dias ?? 30}
          initialMostrarDescProd={(cot as any).mostrar_descuento ?? true}
          initialMostrarDescTotal={(cot as any).mostrar_descuento_total ?? true}
          initialItems={items.map(it => ({
            ...it,
            descuento: it.descuento ?? 0,
          }))}
        />
      </div>
    </div>
  )
}
