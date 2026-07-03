import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile }  from '@/lib/auth'
import { redirect }           from 'next/navigation'
import Link                   from 'next/link'
import { resolverAlerta }     from '@/app/actions/logitech'

export const metadata = { title: 'Alertas de Salas | AV CORE' }

export default async function AlertasRoomsPage() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) redirect('/login')
  if (profile.rol !== 'admin' && profile.rol !== 'superadmin') redirect('/admin')

  const admin = createAdminClient()

  const { data: alertas } = await admin
    .from('logitech_alerts')
    .select(`
      id, type, severity, message, created_at, resolved_at,
      logitech_devices (
        id, name, model_name,
        logitech_rooms ( id, name )
      )
    `)
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(100)

  const activas   = (alertas ?? []).filter(a => !a.resolved_at)
  const resueltas = (alertas ?? []).filter(a =>  a.resolved_at)

  const severityColors: Record<string, string> = {
    high:   'bg-red-50 border-red-200 text-red-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    low:    'bg-blue-50 border-blue-200 text-blue-800',
  }

  const typeLabel: Record<string, string> = {
    offline:           'Dispositivo offline',
    warranty_expiring: 'Garantía por vencer',
    warranty_expired:  'Garantía vencida',
    firmware:          'Actualización de firmware',
  }

  function fmtDate(str: string) {
    return new Date(str).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getRoom(a: any): string | null {
    return a.logitech_devices?.logitech_rooms?.name ?? null
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas de Salas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activas.length} alerta{activas.length !== 1 ? 's' : ''} activa{activas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/admin/rooms"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          ← Volver a salas
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Alta severidad', value: activas.filter(a => a.severity === 'high').length,   color: 'text-red-600'    },
          { label: 'Media severidad', value: activas.filter(a => a.severity === 'medium').length, color: 'text-yellow-600' },
          { label: 'Resueltas hoy',  value: resueltas.filter(a => {
            const hoy = new Date().toISOString().slice(0, 10)
            return (a.resolved_at ?? '').startsWith(hoy)
          }).length, color: 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{k.label}</p>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alertas activas */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Activas</h2>
        {activas.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-green-700 font-medium">Sin alertas activas</p>
            <p className="text-sm text-green-600 mt-1">Todas las salas están operativas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activas.map(a => (
              <div key={a.id}
                className={`flex items-start gap-4 p-4 rounded-xl border ${severityColors[a.severity] ?? severityColors.low}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {typeLabel[a.type] ?? a.type}
                    </span>
                    <span className="text-xs opacity-60">·</span>
                    <span className="text-xs opacity-60">{fmtDate(a.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium">{a.message}</p>
                  {getRoom(a) && (
                    <p className="text-xs opacity-70 mt-0.5">
                      Sala: {getRoom(a)}
                      {a.logitech_devices?.name && ` · ${a.logitech_devices.name}`}
                    </p>
                  )}
                </div>
                <form action={resolverAlerta.bind(null, a.id)}>
                  <button type="submit"
                    className="flex-shrink-0 px-3 py-1.5 bg-white border border-current rounded-lg text-xs font-medium hover:opacity-80 transition-opacity">
                    Resolver
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial resueltas */}
      {resueltas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Historial ({resueltas.length})
          </h2>
          <div className="space-y-2">
            {resueltas.slice(0, 20).map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="flex-1 truncate">{a.message}</span>
                <span className="text-xs flex-shrink-0">
                  Resuelta {fmtDate(a.resolved_at!)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
