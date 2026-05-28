import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ModulosEditor from '@/components/superadmin/ModulosEditor'

export default async function TenantDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [
    { data: tenant },
    { data: admins },
    { count: totalProyectos },
    { count: proyectosActivos },
    { count: totalTickets },
    { count: ticketsAbiertos },
    { count: totalClientes },
  ] = await Promise.all([
    supabase.from('tenants').select('*, modulos').eq('id', id).single(),
    supabase.from('profiles').select('id, nombre, email, activo, created_at').eq('tenant_id', id).eq('rol', 'admin'),
    supabase.from('proyectos').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
    supabase.from('proyectos').select('*', { count: 'exact', head: true }).eq('tenant_id', id).eq('estado', 'activo'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('tenant_id', id).eq('estado', 'abierto'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', id).eq('rol', 'cliente'),
  ])

  if (!tenant) notFound()

  const planColor: Record<string, string> = {
    basico:      'bg-gray-100 text-gray-600',
    profesional: 'bg-blue-100 text-blue-700',
    enterprise:  'bg-violet-100 text-violet-700',
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/superadmin/tenants" className="text-gray-400 hover:text-gray-600 text-sm">← Empresas</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{tenant.nombre}</h1>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${planColor[tenant.plan]}`}>
          {tenant.plan}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tenant.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {tenant.activo ? 'Activa' : 'Suspendida'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Proyectos activos',  value: proyectosActivos ?? 0, sub: `de ${totalProyectos ?? 0} total` },
          { label: 'Tickets abiertos',   value: ticketsAbiertos ?? 0,  sub: `de ${totalTickets ?? 0} total`   },
          { label: 'Clientes finales',   value: totalClientes ?? 0,    sub: 'usuarios cliente'                },
          { label: 'Administradores',    value: admins?.length ?? 0,   sub: 'usuarios admin'                  },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Admins */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Administradores de la empresa</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Registro</th>
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
              </tr>
            ))}
            {!admins?.length && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-gray-400 text-sm">
                  No hay administradores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Módulos */}
      <ModulosEditor
        tenantId={id}
        modulosActivos={(tenant as any).modulos ?? [
          'empresas','contactos','clientes',
          'proyectos','cotizaciones','ordenes','productos','tickets',
        ]}
      />
    </div>
  )
}
