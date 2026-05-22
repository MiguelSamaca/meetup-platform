import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { eliminarCotizacion } from '@/app/actions/cotizaciones'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DeleteButton from '@/components/admin/DeleteButton'

const estadoColor: Record<string, string> = {
  borrador:   'bg-gray-100 text-gray-600',
  enviada:    'bg-blue-100 text-blue-700',
  aprobada:   'bg-emerald-100 text-emerald-700',
  rechazada:  'bg-red-100 text-red-600',
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function ContactoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const [{ data: contacto }, { data: cotizaciones }] = await Promise.all([
    supabase
      .from('contactos')
      .select('*, empresas(nombre)')
      .eq('id', id)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('cotizaciones')
      .select(`
        id, consecutivo, estado, notas, created_at,
        cotizacion_items(cantidad, precio_unitario, moneda_costo, costo_unitario, trm)
      `)
      .eq('contacto_id', id)
      .eq('tenant_id', profile?.tenant_id!)
      .order('created_at', { ascending: false }),
  ])

  if (!contacto) notFound()

  const empresaNombre = (contacto.empresas as unknown as { nombre: string } | null)?.nombre

  // Calcular totales por cotización
  function calcTotales(items: Array<{
    cantidad: number; precio_unitario: number;
    moneda_costo: string; costo_unitario: number; trm: number | null
  }>) {
    let precio = 0, costo = 0
    for (const it of items) {
      const p = it.cantidad * it.precio_unitario
      const c = it.cantidad * (it.moneda_costo === 'USD' ? it.costo_unitario * (it.trm ?? 1) : it.costo_unitario)
      precio += p
      costo  += c
    }
    const margen = precio > 0 ? ((precio - costo) / precio) * 100 : 0
    return { precio, costo, margen }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/contactos" className="text-gray-400 hover:text-gray-600 text-sm">← Contactos</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{contacto.nombre}</h1>
        <Link
          href={`/admin/contactos/${id}/editar`}
          className="ml-auto text-sm text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Editar contacto
        </Link>
      </div>

      {/* Datos del contacto */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {empresaNombre && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Empresa</p>
            <p className="text-gray-800 font-medium">{empresaNombre}</p>
          </div>
        )}
        {contacto.cargo && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Cargo</p>
            <p className="text-gray-800">{contacto.cargo}</p>
          </div>
        )}
        {contacto.email && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Correo</p>
            <p className="text-gray-800">{contacto.email}</p>
          </div>
        )}
        {contacto.telefono && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Teléfono</p>
            <p className="text-gray-800">{contacto.telefono}</p>
          </div>
        )}
        {contacto.notas && (
          <div className="col-span-full">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Notas</p>
            <p className="text-gray-700">{contacto.notas}</p>
          </div>
        )}
      </div>

      {/* Cotizaciones */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Cotizaciones</h2>
        <Link
          href={`/admin/contactos/${id}/cotizaciones/nueva`}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva cotización
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">#</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Items</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Total venta</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Total costo</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Margen</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cotizaciones?.map(cot => {
              const items = (cot.cotizacion_items ?? []) as Array<{
                cantidad: number; precio_unitario: number;
                moneda_costo: string; costo_unitario: number; trm: number | null
              }>
              const { precio, costo, margen } = calcTotales(items)
              const mg = margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-amber-600' : 'text-red-500'
              return (
                <tr key={cot.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{cot.consecutivo}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${estadoColor[cot.estado]}`}>
                      {cot.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{items.length} producto{items.length !== 1 ? 's' : ''}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-800">${fmt(precio)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">${fmt(costo)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${mg}`}>{margen.toFixed(1)}%</span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(cot.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <Link
                        href={`/admin/contactos/${id}/cotizaciones/${cot.id}`}
                        className="text-emerald-600 hover:underline text-xs font-medium"
                      >
                        Ver →
                      </Link>
                      <DeleteButton
                        action={eliminarCotizacion.bind(null, cot.id, id)}
                        confirm={`¿Eliminar la cotización ${cot.consecutivo}?`}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
            {!cotizaciones?.length && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  No hay cotizaciones aún.{' '}
                  <Link href={`/admin/contactos/${id}/cotizaciones/nueva`} className="text-emerald-600 hover:underline">
                    Crear la primera
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
