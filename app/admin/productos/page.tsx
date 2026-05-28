import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { eliminarProducto } from '@/app/actions/productos'
import Link from 'next/link'
import DeleteButton from '@/components/admin/DeleteButton'
import ImportarProductosBtn from '@/components/admin/ImportarProductosBtn'

export default async function ProductosPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const { data: productos } = await supabase
    .from('productos')
    .select('id, referencia, proveedor, descripcion, unidad, activo, created_at')
    .eq('tenant_id', profile?.tenant_id!)
    .order('descripcion')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Productos guardados para reutilizar en cotizaciones. El costo siempre se ingresa al momento de cotizar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportarProductosBtn />
          <Link
            href="/admin/productos/nuevo"
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo producto
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Referencia</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Proveedor</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Descripción</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Unidad</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {productos?.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.referencia ?? '—'}</td>
                <td className="px-5 py-3 text-gray-700 text-sm font-medium">{(p as any).proveedor ?? '—'}</td>
                <td className="px-5 py-3 font-medium text-gray-800">{p.descripcion}</td>
                <td className="px-5 py-3 text-gray-500">{p.unidad}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-4 justify-end">
                    <Link
                      href={`/admin/productos/${p.id}/editar`}
                      className="text-emerald-600 hover:underline text-xs font-medium"
                    >
                      Editar
                    </Link>
                    <DeleteButton
                      action={eliminarProducto.bind(null, p.id)}
                      confirm={`¿Eliminar "${p.descripcion}"? No afecta cotizaciones existentes.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!productos?.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                  No hay productos en el catálogo.{' '}
                  <Link href="/admin/productos/nuevo" className="text-emerald-600 hover:underline">
                    Agregar el primero
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
