import { createAdminClient } from '@/lib/supabase/admin'
import { eliminarSuperAdmin } from '@/app/actions/superadmin'
import DeleteButton from '@/components/admin/DeleteButton'
import Link from 'next/link'

export default async function SuperAdminsPage() {
  const supabase = createAdminClient()

  const { data: admins } = await supabase
    .from('profiles')
    .select('id, nombre, email, activo, created_at')
    .eq('rol', 'superadmin')
    .order('created_at')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SuperAdmins</h1>
          <p className="text-sm text-gray-500 mt-1">Usuarios con acceso total a la plataforma.</p>
        </div>
        <Link
          href="/superadmin/admins/nuevo"
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo superadmin
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Desde</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {admins?.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-800">{a.nombre}</td>
                <td className="px-5 py-3 text-gray-600">{a.email}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {a.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(a.created_at).toLocaleDateString('es-CO')}
                </td>
                <td className="px-5 py-3 text-right">
                  <DeleteButton
                    action={eliminarSuperAdmin.bind(null, a.id)}
                    confirm={`¿Eliminar a ${a.nombre} como superadmin?`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
