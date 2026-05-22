import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { eliminarEmpresa } from '@/app/actions/empresas'
import Link from 'next/link'
import DeleteButton from '@/components/admin/DeleteButton'

export default async function EmpresasPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const [{ data: empresas }, { data: conteos }] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, nombre, nit, telefono, direccion, activo, created_at')
      .eq('tenant_id', profile?.tenant_id!)
      .order('nombre'),
    supabase
      .from('profiles')
      .select('empresa_id')
      .eq('rol', 'cliente')
      .eq('tenant_id', profile?.tenant_id!)
      .not('empresa_id', 'is', null),
  ])

  // Contar usuarios por empresa
  const usuariosPorEmpresa: Record<string, number> = {}
  conteos?.forEach(p => {
    if (p.empresa_id) {
      usuariosPorEmpresa[p.empresa_id] = (usuariosPorEmpresa[p.empresa_id] ?? 0) + 1
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-1">Debes crear la empresa antes de poder crear proyectos o clientes.</p>
        </div>
        <Link
          href="/admin/empresas/nueva"
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva empresa
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Empresa</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">NIT</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Teléfono</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Usuarios</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {empresas?.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{e.nombre}</p>
                  {e.direccion && (
                    <p className="text-xs text-gray-400 mt-0.5">{e.direccion}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-600">{e.nit ?? '—'}</td>
                <td className="px-5 py-3 text-gray-600">{e.telefono ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                    {usuariosPorEmpresa[e.id] ?? 0} usuario{(usuariosPorEmpresa[e.id] ?? 0) !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {e.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-4 justify-end">
                    <Link
                      href={`/admin/empresas/${e.id}/editar`}
                      className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                    >
                      Editar
                    </Link>
                    <DeleteButton
                      action={eliminarEmpresa.bind(null, e.id)}
                      confirm={`¿Eliminar "${e.nombre}"? Esta acción no se puede deshacer.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!empresas?.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                  No hay empresas registradas.{' '}
                  <Link href="/admin/empresas/nueva" className="text-emerald-600 hover:underline">
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
