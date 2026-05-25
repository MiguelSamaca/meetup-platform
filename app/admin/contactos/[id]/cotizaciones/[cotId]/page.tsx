import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { duplicarCotizacion } from '@/app/actions/cotizaciones'

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const estadoColor: Record<string, string> = {
  borrador:  'bg-gray-100 text-gray-600',
  enviada:   'bg-blue-100 text-blue-700',
  aprobada:  'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-600',
}

export default async function DetalleCotizacionPage({
  params,
}: {
  params: Promise<{ id: string; cotId: string }>
}) {
  const { id, cotId } = await params
  const profile       = await getCurrentProfile()
  const supabase      = createAdminClient()

  const [{ data: contacto }, { data: cot }] = await Promise.all([
    supabase
      .from('contactos')
      .select('id, nombre, email, empresas(nombre)')
      .eq('id', id)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('cotizaciones')
      .select(`
        id, consecutivo, estado, notas, created_at,
        cotizacion_items(id, referencia, proveedor, descripcion, cantidad, precio_unitario, moneda_costo, costo_unitario, trm, orden)
      `)
      .eq('id', cotId)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
  ])

  if (!contacto || !cot) notFound()

  const items = ((cot.cotizacion_items ?? []) as Array<{
    id: string; referencia: string | null; proveedor: string | null; descripcion: string
    cantidad: number; precio_unitario: number
    moneda_costo: string; costo_unitario: number; trm: number | null; orden: number
  }>).sort((a, b) => a.orden - b.orden)

  let totalPrecio = 0, totalCosto = 0
  const rows = items.map(it => {
    const precioTotal = it.cantidad * it.precio_unitario
    const costoCOP    = it.moneda_costo === 'USD' ? it.costo_unitario * (it.trm ?? 1) : it.costo_unitario
    const costoTotal  = it.cantidad * costoCOP
    const margen      = precioTotal > 0 ? ((precioTotal - costoTotal) / precioTotal) * 100 : 0
    totalPrecio += precioTotal
    totalCosto  += costoTotal
    return { ...it, precioTotal, costoCOP, costoTotal, margen }
  })
  const margenGlobal  = totalPrecio > 0 ? ((totalPrecio - totalCosto) / totalPrecio) * 100 : 0
  const empresaNombre = (contacto.empresas as unknown as { nombre: string } | null)?.nombre

  const mg = (m: number) => m >= 30 ? 'text-emerald-600' : m >= 15 ? 'text-amber-600' : 'text-red-500'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/contactos/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← {contacto.nombre}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{cot.consecutivo}</h1>
        <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${estadoColor[cot.estado]}`}>
          {cot.estado}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {/* Duplicar — Server Action via form */}
          <form action={duplicarCotizacion.bind(null, cotId, id)}>
            <button
              type="submit"
              className="border border-blue-300 hover:bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              ⧉ Duplicar
            </button>
          </form>
          <Link
            href={`/admin/contactos/${id}/cotizaciones/${cotId}/editar`}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            ✏️ Editar
          </Link>
          <Link
            href={`/admin/contactos/${id}/cotizaciones/${cotId}/imprimir`}
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            🖨️ Ver / Imprimir
          </Link>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Contacto</p>
          <p className="font-medium text-gray-800">{contacto.nombre}</p>
        </div>
        {empresaNombre && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Empresa</p>
            <p className="text-gray-800">{empresaNombre}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Fecha</p>
          <p className="text-gray-800">{new Date(cot.created_at).toLocaleDateString('es-CO')}</p>
        </div>
        {cot.notas && (
          <div className="col-span-full">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Notas</p>
            <p className="text-gray-700">{cot.notas}</p>
          </div>
        )}
      </div>

      {/* Tabla de productos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Ref.</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Proveedor</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Descripción</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Cant.</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Precio unit.</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Total venta</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Costo unit.</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">TRM</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Costo COP</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{r.referencia ?? '—'}</td>
                <td className="px-5 py-3 text-gray-700 text-sm font-medium">{r.proveedor ?? '—'}</td>
                <td className="px-5 py-3 text-gray-800">{r.descripcion}</td>
                <td className="px-5 py-3 text-right text-gray-700">{r.cantidad}</td>
                <td className="px-5 py-3 text-right text-gray-700">${fmt(r.precio_unitario)}</td>
                <td className="px-5 py-3 text-right font-medium text-gray-900">${fmt(r.precioTotal)}</td>
                <td className="px-5 py-3 text-right text-gray-600">
                  {r.moneda_costo === 'USD' ? `USD ${r.costo_unitario.toFixed(2)}` : `$${fmt(r.costo_unitario)}`}
                </td>
                <td className="px-5 py-3 text-right text-gray-500 text-xs">
                  {r.trm ? fmt(r.trm) : '—'}
                </td>
                <td className="px-5 py-3 text-right text-gray-600">${fmt(r.costoTotal)}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`font-semibold ${mg(r.margen)}`}>{r.margen.toFixed(1)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr className="bg-gray-50">
              <td colSpan={5} className="px-5 py-2.5 text-xs font-semibold text-gray-500 text-right uppercase tracking-wide">Subtotal productos</td>
              <td className="px-5 py-2.5 text-right font-bold text-gray-900">${fmt(totalPrecio)}</td>
              <td colSpan={2} />
              <td className="px-5 py-2.5 text-right font-bold text-gray-700">${fmt(totalCosto)}</td>
              <td className="px-5 py-2.5 text-right">
                <span className={`text-base font-bold ${mg(margenGlobal)}`}>{margenGlobal.toFixed(1)}%</span>
              </td>
            </tr>
            <tr className="bg-emerald-50 border-t border-emerald-100">
              <td colSpan={4} />
              <td className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">SUBTOTAL</td>
              <td className="px-5 py-2 text-right font-semibold text-gray-800">${fmt(totalPrecio)}</td>
              <td colSpan={4} />
            </tr>
            <tr className="bg-emerald-50">
              <td colSpan={4} />
              <td className="px-5 py-1.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">IVA 19%</td>
              <td className="px-5 py-1.5 text-right text-gray-600">${fmt(totalPrecio * 0.19)}</td>
              <td colSpan={4} />
            </tr>
            <tr className="bg-emerald-50 border-t-2 border-emerald-200">
              <td colSpan={4} />
              <td className="px-5 py-3 text-right text-sm font-bold text-gray-800 uppercase tracking-wide">TOTAL</td>
              <td className="px-5 py-3 text-right text-lg font-bold text-emerald-700">${fmt(totalPrecio * 1.19)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
