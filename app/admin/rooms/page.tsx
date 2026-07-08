import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile }  from '@/lib/auth'
import { redirect }           from 'next/navigation'
import Link                   from 'next/link'

export const metadata = { title: 'Estado de Salas | AV CORE' }

interface RoomWithDevices {
  id:                uuid
  name:              string | null
  type:              string | null
  location:          string | null
  capacity:          number | null
  updated_at:        string | null
  logitech_devices:  {
    id:           uuid
    name:         string | null
    model_name:   string | null
    is_online:    boolean
    warranty_status: string | null
    warranty_expires: string | null
    temperature:  number | null
    humidity:     number | null
  }[]
}
type uuid = string

export default async function RoomsPage() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) redirect('/login')
  if (profile.rol !== 'admin' && profile.rol !== 'superadmin') redirect('/admin')

  const admin = createAdminClient()

  const { data: cfg } = await admin
    .from('logitech_org_config')
    .select('logitech_org_id, last_sync_at, polling_interval_sec')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  const { data: rooms } = await admin
    .from('logitech_rooms')
    .select(`
      id, name, type, location, capacity, updated_at,
      logitech_devices (
        id, name, model_name, is_online, warranty_status,
        warranty_expires, temperature, humidity
      )
    `)
    .eq('tenant_id', profile.tenant_id)
    .order('name') as { data: RoomWithDevices[] | null }

  const { count: alertasActivas } = await admin
    .from('logitech_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .is('resolved_at', null)

  // KPIs globales
  const allDevices  = (rooms ?? []).flatMap(r => r.logitech_devices)
  const totalSalas  = rooms?.length ?? 0
  const totalDevs   = allDevices.length
  const onlineDevs  = allDevices.filter(d => d.is_online).length
  const offlineDevs = totalDevs - onlineDevs

  function statusColor(room: RoomWithDevices) {
    if (room.logitech_devices.length === 0) return 'gray'
    const allOnline = room.logitech_devices.every(d => d.is_online)
    const anyOnline = room.logitech_devices.some(d => d.is_online)
    if (allOnline)  return 'green'
    if (anyOnline)  return 'yellow'
    return 'red'
  }

  const colorMap = {
    green:  { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200',  label: 'Operativa'  },
    yellow: { dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Parcial' },
    red:    { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',        label: 'Offline'    },
    gray:   { dot: 'bg-gray-400',   badge: 'bg-gray-50 text-gray-500 border-gray-200',     label: 'Sin equipos'},
  }

  const sincStr = cfg?.last_sync_at
    ? new Date(cfg.last_sync_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
    : 'Nunca'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estado de Salas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Última sincronización: {sincStr}
            {cfg?.polling_interval_sec && (
              <span className="ml-2 text-gray-400">
                · Auto cada {Math.round(cfg.polling_interval_sec / 60)} min
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(alertasActivas ?? 0) > 0 && (
            <Link href="/admin/rooms/alertas"
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium hover:bg-red-100 transition-colors">
              ⚠ {alertasActivas} alerta{(alertasActivas ?? 0) !== 1 ? 's' : ''} activa{(alertasActivas ?? 0) !== 1 ? 's' : ''}
            </Link>
          )}
          <Link href="/admin/rooms/diagnostico"
            className="px-4 py-2 bg-white border border-blue-600 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
            Prueba de conexión
          </Link>
          {!cfg && (
            <Link href="/admin/rooms/configuracion"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Configurar integración
            </Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Salas', value: totalSalas, icon: '⬡', color: 'text-blue-600' },
          { label: 'Dispositivos', value: totalDevs, icon: '◈', color: 'text-gray-700' },
          { label: 'Online', value: onlineDevs, icon: '◎', color: 'text-green-600' },
          { label: 'Offline', value: offlineDevs, icon: '◉', color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-lg ${k.color}`}>{k.icon}</span>
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</span>
            </div>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Sin configuración */}
      {!cfg && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-blue-800 font-medium mb-2">Integración Logitech no configurada</p>
          <p className="text-sm text-blue-600 mb-4">
            Configura el Logitech Org ID y los certificados mTLS para comenzar a sincronizar salas.
          </p>
          <Link href="/admin/rooms/configuracion"
            className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Ir a configuración →
          </Link>
        </div>
      )}

      {/* Grid de salas */}
      {(rooms?.length ?? 0) === 0 && cfg && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500">No se han sincronizado salas aún.</p>
          <p className="text-sm text-gray-400 mt-1">El cron job sincroniza automáticamente cada {Math.round((cfg.polling_interval_sec ?? 300) / 60)} minutos.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(rooms ?? []).map(room => {
          const status  = statusColor(room)
          const colors  = colorMap[status]
          const devs    = room.logitech_devices
          const onlines = devs.filter(d => d.is_online).length
          const temps   = devs.filter(d => d.temperature != null).map(d => d.temperature!)
          const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null

          return (
            <Link key={room.id} href={`/admin/rooms/${room.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group">
              {/* Header sala */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                    {room.name ?? 'Sala sin nombre'}
                  </h3>
                  {room.location && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{room.location}</p>
                  )}
                </div>
                <span className={`ml-3 flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${colors.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  {colors.label}
                </span>
              </div>

              {/* Métricas */}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{onlines}/{devs.length} dispositivos</span>
                {room.capacity && <span>· Cap. {room.capacity}</span>}
                {avgTemp != null && <span>· {avgTemp}°C</span>}
              </div>

              {/* Mini lista dispositivos */}
              {devs.length > 0 && (
                <div className="mt-3 space-y-1">
                  {devs.slice(0, 3).map(d => (
                    <div key={d.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.is_online ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="truncate">{d.name ?? d.model_name ?? 'Dispositivo'}</span>
                      {d.warranty_status === 'Expired' && (
                        <span className="ml-auto flex-shrink-0 text-red-500">Gtía vencida</span>
                      )}
                    </div>
                  ))}
                  {devs.length > 3 && (
                    <p className="text-xs text-gray-400 pl-3.5">+{devs.length - 3} más</p>
                  )}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
