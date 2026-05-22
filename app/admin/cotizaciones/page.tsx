import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import Link from 'next/link'

interface SearchParams { q?: string; estado?: string }

const estadoColor: Record<string, string> = {
  borrador:  'bg-gray-100 text-gray-600',
  enviada:   'bg-blue-100 text-blue-700',
  aprobada:  'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-600',
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, estado } = await searchParams
  const profile       = await getCurrentProfile()
  const supabase      = createAdminClient()

  const { data: cotizaciones } = await supabase
    .from('cotizaciones')
    .select(`
      id, consecutivo, estado, notas, fecha, validez_dias, created_at,
      contactos(id, nombre, empresas(nombre)),
      cotizacion_items(cantidad, precio_unitario, moneda_costo, costo_unitario, trm)
    `)
    .eq('tenant_id', profile?.tenant_id!)
    .order('created_at', { ascending: false })

  type CotRow = NonNullable<typeof cotizaciones>[number]

  function computeTotals(cot: CotRow) {
    let totalPrecio = 0, totalCosto = 0
    const items = (cot.cotizacion_items ?? []) as Array<{
      cantidad: number; precio_unitario: number
      moneda_costo: string; costo_unitario: number; trm: number | null
    }>
    for (const it of items) {
      const p = it.cantidad * it.precio_unitario
      const costoCOP = it.moneda_costo === 'USD' ? it.costo_unitario * (it.trm ?? 1) : it.costo_unitario
      const c = it.cantidad * costoCOP
      totalPrecio += p
      totalCosto  += c
    }
    const margen = totalPrecio > 0 ? ((totalPrecio - totalCosto) / totalPrecio) * 100 : 0
    return { totalPrecio, totalCosto, margen }
  }

  let rows = (cotizaciones ?? []).map(cot => ({
    ...cot,
    ...computeTotals(cot),
    contactoNombre: (cot.contactos as unknown as { nombre: string } | null)?.nombre ?? '—',
    contactoId:     (cot.contactos as unknown as { id: string } | null)?.id ?? '',
    empresaNombre:  ((cot.contactos as unknown as { empresas: { nombre: string } | null } | null)?.empresas)?.nombre ?? null,
  }))

  // Filtros
  if (q)      rows = rows.filter(r => r.consecutivo.toLowerCase().includes(q.toLowerCase()) || r.contactoNombre.toLowerCase().includes(q.toLowerCase()))
  if (estado) rows = rows.filter(r => r.estado === estado)

  const mgColor = (m: number) => m >= 30 ? 'text-emerald-600' : m >= 15 ? 'text-amber-600' : 'text-red-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">Todas las cotizaciones de tus contactos.</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por consecutivo o contacto..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          name="estado"
          defaultValue={estado ?? ''}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviada</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors">
          Filtrar
        </button>
        {(q || estado) && (
          <Link href="/admin/cotizaciones" className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Limpiar
          </Link>
        )}
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Consecutivo</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Contacto</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Empresa</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Total venta</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Margen</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs font-medium text-gray-700">
                  <Link href={`/admin/contactos/${r.contactoId}/cotizaciones/${r.id}`} className="hover:text-emerald-600 transition-colors">
                    {r.consecutivo}
                  </Link>
                </td>
                <td className="px-5 py-3 text-gray-800">
                  <Link href={`/admin/contactos/${r.contactoId}`} className="hover:text-emerald-600 transition-colors">
                    {r.contactoNombre}
                  </Link>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{r.empresaNombre ?? '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {r.fecha ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-CO') : '—'}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${estadoColor[r.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                    {r.estado}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-medium text-gray-900">${fmt(r.totalPrecio)}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`font-semibold ${mgColor(r.margen)}`}>{r.margen.toFixed(1)}%</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 justify-end">
                    <Link href={`/admin/contactos/${r.contactoId}/cotizaciones/${r.id}`} className="text-emerald-600 hover:underline text-xs font-medium">
                      Ver
                    </Link>
                    <Link href={`/admin/contactos/${r.contactoId}/cotizaciones/${r.id}/editar`} className="text-gray-500 hover:text-gray-700 text-xs font-medium">
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  No hay cotizaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
          <span>{rows.length} cotización{rows.length !== 1 ? 'es' : ''}</span>
          <span className="font-medium text-gray-700">
            Total: ${fmt(rows.reduce((s, r) => s + r.totalPrecio, 0))}
          </span>
          <span className={`font-semibold ${mgColor(rows.reduce((s, r) => s + r.totalPrecio, 0) > 0
            ? ((rows.reduce((s, r) => s + r.totalPrecio, 0) - rows.reduce((s, r) => s + r.totalCosto, 0)) / rows.reduce((s, r) => s + r.totalPrecio, 0)) * 100
            : 0)}`}>
            Margen promedio: {(rows.reduce((s, r) => s + r.totalPrecio, 0) > 0
              ? ((rows.reduce((s, r) => s + r.totalPrecio, 0) - rows.reduce((s, r) => s + r.totalCosto, 0)) / rows.reduce((s, r) => s + r.totalPrecio, 0)) * 100
              : 0).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}
