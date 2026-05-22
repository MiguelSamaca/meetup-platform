import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { eliminarCliente } from '@/app/actions/clientes'
import Link from 'next/link'
import DeleteButton from '@/components/admin/DeleteButton'

export default async function ClientesPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const { data: clientes } = await supabase
    .from('profiles')
    .select('id, nombre, email, empresa, telefono, activo, created_at')
    .eq('rol', 'cliente')
    .eq('tenant_id', profile?.tenant_id!)
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
              <th className="px-5 py-3"></th>
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
                <td className="px-5 py-3">
                  <div className="flex items-center gap-4 justify-end">
                    <Link
                      href={`/admin/clientes/${c.id}/editar`}
                      className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                    >
                      Editar
                    </Link>
                    <DeleteButton
                      action={eliminarCliente.bind(null, c.id)}
                      confirm={`¿Eliminar a ${c.nombre}? Se eliminará su cuenta y todos sus datos.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!clientes?.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
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
