import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

/* ── Helpers ─────────────────────────────────────── */
const ACCION_LABELS: Record<string, { label: string; color: string }> = {
  login:                  { label: 'Login',             color: 'bg-blue-100 text-blue-700'     },
  login_fallido:          { label: 'Login fallido',     color: 'bg-red-100 text-red-700'       },
  logout:                 { label: 'Logout',            color: 'bg-gray-100 text-gray-600'     },
  crear_cotizacion:       { label: 'Nueva cotización',  color: 'bg-emerald-100 text-emerald-700'},
  editar_cotizacion:      { label: 'Editó cotización',  color: 'bg-emerald-50 text-emerald-600'},
  eliminar_cotizacion:    { label: 'Eliminó cot.',      color: 'bg-red-100 text-red-700'       },
  crear_producto:         { label: 'Nuevo producto',    color: 'bg-violet-100 text-violet-700' },
  editar_producto:        { label: 'Editó producto',    color: 'bg-violet-50 text-violet-600'  },
  crear_contacto:         { label: 'Nuevo contacto',    color: 'bg-cyan-100 text-cyan-700'     },
  editar_contacto:        { label: 'Editó contacto',    color: 'bg-cyan-50 text-cyan-600'      },
  crear_empresa:          { label: 'Nueva empresa',     color: 'bg-amber-100 text-amber-700'   },
  editar_empresa:         { label: 'Editó empresa',     color: 'bg-amber-50 text-amber-600'    },
  crear_proyecto:         { label: 'Nuevo proyecto',    color: 'bg-indigo-100 text-indigo-700' },
  editar_proyecto:        { label: 'Editó proyecto',    color: 'bg-indigo-50 text-indigo-600'  },
  crear_ticket:           { label: 'Nuevo ticket',      color: 'bg-orange-100 text-orange-700' },
  responder_ticket:       { label: 'Respondió ticket',  color: 'bg-orange-50 text-orange-600'  },
  cambiar_estado_ticket:  { label: 'Cambió estado',     color: 'bg-yellow-100 text-yellow-700' },
  subir_imagen:           { label: 'Subió imagen',      color: 'bg-pink-100 text-pink-700'     },
  crear_cliente:          { label: 'Nuevo usuario',     color: 'bg-teal-100 text-teal-700'     },
  editar_cliente:         { label: 'Editó usuario',     color: 'bg-teal-50 text-teal-600'      },
  crear_admin:            { label: 'Nuevo admin',       color: 'bg-slate-100 text-slate-700'   },
  suspender_tenant:       { label: 'Suspendió empresa', color: 'bg-red-200 text-red-800'       },
  activar_tenant:         { label: 'Activó empresa',    color: 'bg-green-100 text-green-700'   },
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params    = await searchParams
  const admin     = createAdminClient()

  /* ── Filtros ── */
  const tenantFilter    = typeof params.tenant   === 'string' ? params.tenant   : ''
  const resultadoFilter = typeof params.resultado === 'string' ? params.resultado : ''
  const accionFilter    = typeof params.accion   === 'string' ? params.accion   : ''
  const tabFilter       = typeof params.tab      === 'string' ? params.tab      : 'todos'

  /* ── Tenants para el selector ── */
  const { data: tenants } = await admin
    .from('tenants')
    .select('id, nombre')
    .order('nombre')

  /* ── Query principal ── */
  let query = admin
    .from('audit_logs')
    .select('id, created_at, tenant_id, user_email, user_nombre, accion, entidad, entidad_id, detalles, resultado, error_msg, tenants(nombre)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (tenantFilter)    query = query.eq('tenant_id', tenantFilter)
  if (resultadoFilter) query = query.eq('resultado', resultadoFilter)
  if (accionFilter)    query = query.eq('accion', accionFilter)

  // Filtros por tab
  if (tabFilter === 'sesiones') query = query.in('accion', ['login', 'login_fallido', 'logout'])
  if (tabFilter === 'errores')  query = query.eq('resultado', 'error')

  const { data: logs } = await query

  /* ── Conteos para tabs ── */
  const [{ count: totalLogs }, { count: errores }, { count: sesiones }] = await Promise.all([
    admin.from('audit_logs').select('*', { count: 'exact', head: true }),
    admin.from('audit_logs').select('*', { count: 'exact', head: true }).eq('resultado', 'error'),
    admin.from('audit_logs').select('*', { count: 'exact', head: true }).in('accion', ['login', 'login_fallido', 'logout']),
  ])

  /* ── Acciones únicas para el selector ── */
  const accionesUnicas = Object.keys(ACCION_LABELS)

  type LogRow = {
    id: string
    created_at: string
    tenant_id: string | null
    user_email: string | null
    user_nombre: string | null
    accion: string
    entidad: string | null
    entidad_id: string | null
    detalles: Record<string, unknown> | null
    resultado: string
    error_msg: string | null
    tenants: { nombre: string } | null
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Historial de Actividad</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro completo de acciones por empresa, usuario y sesión.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'todos',    label: 'Todos',    count: totalLogs  ?? 0 },
          { key: 'errores',  label: 'Errores',  count: errores    ?? 0 },
          { key: 'sesiones', label: 'Sesiones', count: sesiones   ?? 0 },
        ].map(tab => (
          <Link
            key={tab.key}
            href={`/superadmin/logs?tab=${tab.key}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tabFilter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab.key === 'errores'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Filtros ── */}
      <form method="GET" action="/superadmin/logs" className="flex flex-wrap gap-3 mb-5">
        <input type="hidden" name="tab" value={tabFilter} />

        <select name="tenant" defaultValue={tenantFilter}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
          <option value="">Todas las empresas</option>
          {tenants?.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>

        <select name="accion" defaultValue={accionFilter}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
          <option value="">Todas las acciones</option>
          {accionesUnicas.map(a => (
            <option key={a} value={a}>{ACCION_LABELS[a]?.label ?? a}</option>
          ))}
        </select>

        <select name="resultado" defaultValue={resultadoFilter}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
          <option value="">Todos los resultados</option>
          <option value="exito">✅ Éxito</option>
          <option value="error">❌ Error</option>
        </select>

        <button type="submit"
          className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
          Filtrar
        </button>
        <Link href="/superadmin/logs"
          className="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Limpiar
        </Link>
      </form>

      {/* ── Tabla ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando <span className="font-semibold text-gray-700">{logs?.length ?? 0}</span> registros
            {logs && logs.length >= 200 && ' (máx. 200)'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">Fecha / Hora</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">Empresa</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">Usuario</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-40">Acción</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Detalle</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(logs as LogRow[] | null)?.map(log => {
                const badge = ACCION_LABELS[log.accion] ?? { label: log.accion, color: 'bg-gray-100 text-gray-600' }
                const tenantNombre = (log.tenants as { nombre: string } | null)?.nombre ?? '—'
                return (
                  <tr key={log.id} className={`hover:bg-gray-50 ${log.resultado === 'error' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {fmt(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-700">{tenantNombre}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-700">{log.user_nombre ?? '—'}</p>
                      <p className="text-xs text-gray-400">{log.user_email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.error_msg ? (
                        <p className="text-xs text-red-600 font-medium">{log.error_msg}</p>
                      ) : log.detalles ? (
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {Object.entries(log.detalles)
                            .filter(([, v]) => v !== null && v !== undefined)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.resultado === 'error' ? (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          ❌ Error
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          ✅ OK
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!logs?.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
