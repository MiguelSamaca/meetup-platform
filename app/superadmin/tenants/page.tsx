import { createAdminClient } from '@/lib/supabase/admin'
import { toggleTenant, eliminarTenant } from '@/app/actions/superadmin'
import DeleteButton from '@/components/admin/DeleteButton'
import Link from 'next/link'

export default async function TenantsPage() {
  const supabase = createAdminClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, nombre, slug, plan, activo, created_at')
    .order('created_at', { ascending: false })

  // Contar admins y proyectos por tenant
  const { data: adminCounts } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('rol', 'admin')
    .not('tenant_id', 'is', null)

  const { data: proyectoCounts } = await supabase
    .from('proyectos')
    .select('tenant_id')
    .not('tenant_id', 'is', null)

  const adminsPorTenant: Record<string, number>    = {}
  const proyectosPorTenant: Record<string, number> = {}

  adminCounts?.forEach(p => {
    if (p.tenant_id) adminsPorTenant[p.tenant_id] = (adminsPorTenant[p.tenant_id] ?? 0) + 1
  })
  proyectoCounts?.forEach(p => {
    if (p.tenant_id) proyectosPorTenant[p.tenant_id] = (proyectosPorTenant[p.tenant_id] ?? 0) + 1
  })

  const planColor: Record<string, string> = {
    basico:      'bg-gray-100 text-gray-600',
    profesional: 'bg-blue-100 text-blue-700',
    enterprise:  'bg-violet-100 text-violet-700',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas integradoras</h1>
          <p className="text-sm text-gray-500 mt-1">Todos los tenants registrados en la plataforma.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Empresa</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Plan</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Admins</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Proyectos</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Registro</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tenants?.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{t.nombre}</p>
                  {t.slug && <p className="text-xs text-gray-400 mt-0.5">{t.slug}</p>}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${planColor[t.plan]}`}>
                    {t.plan}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-600">{adminsPorTenant[t.id] ?? 0}</td>
                <td className="px-5 py-3 text-gray-600">{proyectosPorTenant[t.id] ?? 0}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {t.activo ? 'Activa' : 'Suspendida'}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(t.created_at).toLocaleDateString('es-CO')}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 justify-end">
                    <Link
                      href={`/superadmin/tenants/${t.id}`}
                      className="text-violet-600 hover:underline text-xs font-medium"
                    >
                      Ver →
                    </Link>
                    <form action={toggleTenant.bind(null, t.id, !t.activo)}>
                      <button
                        type="submit"
                        className={`text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${
                          t.activo
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {t.activo ? 'Suspender' : 'Activar'}
                      </button>
                    </form>
                    <DeleteButton
                      action={eliminarTenant.bind(null, t.id)}
                      confirm={`¿Eliminar "${t.nombre}"? Se eliminarán todos sus datos permanentemente.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!tenants?.length && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                  No hay empresas registradas aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
