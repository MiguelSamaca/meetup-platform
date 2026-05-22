import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function SuperAdminDashboard() {
  const supabase = createAdminClient()

  const [
    { count: totalTenants },
    { count: tenantsActivos },
    { count: totalAdmins },
    { count: totalClientes },
    { count: totalProyectos },
    { count: ticketsAbiertos },
    { data: tenantsRecientes },
  ] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('rol', 'admin'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('rol', 'cliente'),
    supabase.from('proyectos').select('*', { count: 'exact', head: true }),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
    supabase.from('tenants')
      .select('id, nombre, plan, activo, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const stats = [
    { label: 'Empresas activas',   value: tenantsActivos ?? 0,  sub: `de ${totalTenants ?? 0} total`,    color: 'text-violet-600' },
    { label: 'Admins registrados', value: totalAdmins ?? 0,     sub: 'usuarios admin',                   color: 'text-blue-600'   },
    { label: 'Clientes finales',   value: totalClientes ?? 0,   sub: 'usuarios cliente',                  color: 'text-emerald-600'},
    { label: 'Proyectos totales',  value: totalProyectos ?? 0,  sub: 'en toda la plataforma',             color: 'text-amber-600'  },
    { label: 'Tickets abiertos',   value: ticketsAbiertos ?? 0, sub: 'requieren atención',                color: 'text-red-600'    },
  ]

  const planColor: Record<string, string> = {
    basico:       'bg-gray-100 text-gray-600',
    profesional:  'bg-blue-100 text-blue-700',
    enterprise:   'bg-violet-100 text-violet-700',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel SuperAdmin</h1>
        <p className="text-sm text-gray-500 mt-1">Vista global de toda la plataforma.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Últimas empresas registradas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Últimas empresas registradas</h2>
          <Link href="/superadmin/tenants" className="text-sm text-violet-600 hover:underline">
            Ver todas →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Empresa</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Plan</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tenantsRecientes?.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-800">{t.nombre}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${planColor[t.plan]}`}>
                    {t.plan}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {t.activo ? 'Activa' : 'Suspendida'}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(t.created_at).toLocaleDateString('es-CO')}
                </td>
              </tr>
            ))}
            {!tenantsRecientes?.length && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">
                  Aún no hay empresas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
