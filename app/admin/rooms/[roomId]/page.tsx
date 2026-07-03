import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile }  from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link                   from 'next/link'

export const metadata = { title: 'Detalle de Sala | AV CORE' }

interface DeviceWithHistory {
  id:                uuid
  name:              string | null
  model_name:        string | null
  serial_number:     string | null
  firmware_version:  string | null
  is_online:         boolean
  warranty_status:   string | null
  warranty_expires:  string | null
  ip_address:        string | null
  mac_address:       string | null
  temperature:       number | null
  humidity:          number | null
  updated_at:        string | null
}
type uuid = string

export default async function RoomDetailPage({
  params,
}: {
  params: { roomId: string }
}) {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) redirect('/login')
  if (profile.rol !== 'admin' && profile.rol !== 'superadmin') redirect('/admin')

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('logitech_rooms')
    .select('id, name, type, location, capacity, updated_at, logitech_place_id')
    .eq('id', params.roomId)
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  if (!room) notFound()

  const { data: devices } = await admin
    .from('logitech_devices')
    .select(`
      id, name, model_name, serial_number, firmware_version,
      is_online, warranty_status, warranty_expires,
      ip_address, mac_address, temperature, humidity, updated_at
    `)
    .eq('room_id', room.id)
    .eq('tenant_id', profile.tenant_id)
    .order('name') as { data: DeviceWithHistory[] | null }

  // Últimos snapshots de cada device (tendencia 24h)
  const deviceIds = (devices ?? []).map(d => d.id)
  const { data: snapshots } = deviceIds.length > 0
    ? await admin
        .from('logitech_device_snapshots')
        .select('device_id, is_online, device_state, temperature, captured_at')
        .in('device_id', deviceIds)
        .gte('captured_at', new Date(Date.now() - 86400000).toISOString())
        .order('captured_at', { ascending: false })
    : { data: [] }

  // Alertas activas de esta sala
  const { data: alertas } = await admin
    .from('logitech_alerts')
    .select('id, type, severity, message, created_at')
    .in('device_id', deviceIds)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })

  function warrantyColor(status: string | null) {
    if (status === 'Active')  return 'text-green-600 bg-green-50 border-green-200'
    if (status === 'Expired') return 'text-red-600 bg-red-50 border-red-200'
    return 'text-gray-500 bg-gray-50 border-gray-200'
  }

  function fmtDate(str: string | null) {
    if (!str) return '—'
    return new Date(str).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
  }

  const onlineCount = (devices ?? []).filter(d => d.is_online).length

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/rooms"
            className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">
            ← Salas
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{room.name ?? 'Sala sin nombre'}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {room.type && <span>{room.type}</span>}
            {room.location && <><span>·</span><span>{room.location}</span></>}
            {room.capacity && <><span>·</span><span>Capacidad: {room.capacity}</span></>}
          </div>
        </div>
        <div className="text-right">
          <span className={`text-sm font-medium px-3 py-1 rounded-full border ${
            onlineCount === (devices?.length ?? 0) && onlineCount > 0
              ? 'bg-green-50 text-green-700 border-green-200'
              : onlineCount === 0
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
          }`}>
            {onlineCount}/{devices?.length ?? 0} online
          </span>
          <p className="text-xs text-gray-400 mt-1">Sync: {fmtDate(room.updated_at)}</p>
        </div>
      </div>

      {/* Alertas activas */}
      {(alertas?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {alertas!.map(a => (
            <div key={a.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                a.severity === 'high'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}>
              <span>⚠</span>
              <span className="flex-1">{a.message}</span>
              <Link href="/admin/rooms/alertas"
                className="text-xs underline opacity-70 hover:opacity-100">
                Ver alertas
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Dispositivos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Dispositivos ({devices?.length ?? 0})
        </h2>
        {(devices?.length ?? 0) === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
            No hay dispositivos registrados para esta sala.
          </div>
        ) : (
          <div className="space-y-3">
            {(devices ?? []).map(dev => {
              const devSnaps = (snapshots ?? []).filter(s => s.device_id === dev.id)
              const uptime = devSnaps.length > 0
                ? Math.round((devSnaps.filter(s => s.is_online).length / devSnaps.length) * 100)
                : null

              return (
                <div key={dev.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  {/* Device header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dev.is_online ? 'bg-green-500' : 'bg-red-500'}`} />
                        <h3 className="font-semibold text-gray-900">
                          {dev.name ?? dev.model_name ?? 'Dispositivo'}
                        </h3>
                      </div>
                      {dev.model_name && dev.name !== dev.model_name && (
                        <p className="text-xs text-gray-400 ml-4">{dev.model_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${warrantyColor(dev.warranty_status)}`}>
                        Gtía: {dev.warranty_status ?? 'Desconocida'}
                      </span>
                    </div>
                  </div>

                  {/* Métricas grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'S/N', value: dev.serial_number ?? '—' },
                      { label: 'Firmware', value: dev.firmware_version ?? '—' },
                      { label: 'IP', value: dev.ip_address ?? '—' },
                      { label: 'MAC', value: dev.mac_address ?? '—' },
                    ].map(m => (
                      <div key={m.label}>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{m.label}</p>
                        <p className="text-xs text-gray-700 font-mono mt-0.5 truncate" title={m.value}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Ambiente + uptime */}
                  <div className="flex items-center gap-4 pt-1 border-t border-gray-100">
                    {dev.temperature != null && (
                      <span className="text-xs text-gray-500">
                        🌡 {dev.temperature}°C
                      </span>
                    )}
                    {dev.humidity != null && (
                      <span className="text-xs text-gray-500">
                        💧 {dev.humidity}%
                      </span>
                    )}
                    {uptime != null && (
                      <span className="text-xs text-gray-500 ml-auto">
                        Uptime 24h: <strong>{uptime}%</strong> ({devSnaps.length} lecturas)
                      </span>
                    )}
                    {dev.warranty_expires && (
                      <span className="text-xs text-gray-400">
                        Gtía hasta: {new Date(dev.warranty_expires).toLocaleDateString('es-CO')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
