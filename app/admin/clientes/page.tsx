import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function ClientesPage() {
  const supabase = createAdminClient()
  const { data: clientes } = await supabase
    .from('profiles')
    .select('id, nombre, email, empresa, telefono, activo, created_at')
    .eq('rol', 'cliente')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Link
          href="/admin/clientes/nuevo"
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Empresa</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Correo</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Teléfono</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clientes?.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-5 py-3 text-gray-600">{c.empresa ?? '—'}</td>
                <td className="px-5 py-3 text-gray-600">{c.email}</td>
                <td className="px-5 py-3 text-gray-600">{c.telefono ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
            {!clientes?.length && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                  No hay clientes registrados.{' '}
                  <Link href="/admin/clientes/nuevo" className="text-emerald-600 hover:underline">Crear el primero</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
