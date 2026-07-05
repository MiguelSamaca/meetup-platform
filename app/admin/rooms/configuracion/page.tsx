import { createAdminClient }    from '@/lib/supabase/admin'
import { getCurrentProfile }     from '@/lib/auth'
import { redirect }              from 'next/navigation'
import Link                      from 'next/link'
import { guardarConfigLogitech, forzarSincronizacion } from '@/app/actions/logitech'

export const metadata = { title: 'Configuración Salas | AV CORE' }

export default async function ConfiguracionRoomsPage() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) redirect('/login')
  if (profile.rol !== 'admin' && profile.rol !== 'superadmin') redirect('/admin')

  const admin = createAdminClient()

  const { data: cfg } = await admin
    .from('logitech_org_config')
    .select('logitech_org_id, polling_interval_sec, last_sync_at, collabos_enabled')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  const sincStr = cfg?.last_sync_at
    ? new Date(cfg.last_sync_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Salas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Integración con Logitech Sync Cloud API</p>
        </div>
        <Link href="/admin/rooms"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          ← Volver a salas
        </Link>
      </div>

      {/* Estado de sincronización */}
      {cfg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Integración activa</p>
              {sincStr && (
                <p className="text-xs text-green-600 mt-0.5">Última sincronización: {sincStr}</p>
              )}
            </div>
            <form action={async () => {
              'use server'
              await forzarSincronizacion()
            }}>
              <button type="submit"
                className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-medium hover:bg-green-800 transition-colors">
                Sincronizar ahora
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Formulario */}
      <form action={guardarConfigLogitech} className="space-y-5">
        {/* Logitech Org ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logitech Organization ID
          </label>
          <input
            type="text"
            name="logitech_org_id"
            defaultValue={cfg?.logitech_org_id ?? ''}
            placeholder="A2ePIvGymzdt..."
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">
            Visible en el portal Logitech Sync → Organización
          </p>
        </div>

        {/* Certificado mTLS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Certificado mTLS (certificate.pem)
          </label>
          <textarea
            name="cert_pem"
            rows={6}
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Pega solo si quieres actualizar. El certificado actual no se muestra por seguridad.
          </p>
        </div>

        {/* Llave privada */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Llave privada mTLS (privateKey.pem)
          </label>
          <textarea
            name="private_key_pem"
            rows={6}
            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Pega solo si quieres actualizar. Se almacena cifrada.
          </p>
        </div>

        {/* Intervalo de polling */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Intervalo de sincronización
          </label>
          <select
            name="polling_interval_sec"
            defaultValue={cfg?.polling_interval_sec ?? 300}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={60}>Cada 1 minuto (requiere Vercel Pro)</option>
            <option value={300}>Cada 5 minutos</option>
            <option value={600}>Cada 10 minutos</option>
            <option value={1800}>Cada 30 minutos</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Guardar configuración
        </button>
      </form>

      {/* Información técnica */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Información técnica</h3>
        <div className="space-y-2 text-xs text-gray-500">
          <div className="flex gap-2">
            <span className="font-medium text-gray-600 w-32 flex-shrink-0">API Base URL</span>
            <code className="font-mono">https://api.sync.logitech.com</code>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-gray-600 w-32 flex-shrink-0">Autenticación</span>
            <span>mTLS (certificado cliente + llave privada)</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-gray-600 w-32 flex-shrink-0">Cron endpoint</span>
            <code className="font-mono">/api/cron/logitech-poll</code>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-gray-600 w-32 flex-shrink-0">CollabOS (LAN)</span>
            <span>{cfg?.collabos_enabled ? 'Habilitado' : 'Deshabilitado — requiere agente local con VPN'}</span>
          </div>
        </div>
      </div>

      {/* Instrucciones de obtención de certificados */}
      <details className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <summary className="text-sm font-medium text-blue-800 cursor-pointer">
          ¿Cómo obtener los certificados mTLS?
        </summary>
        <ol className="mt-3 space-y-1.5 text-xs text-blue-700 list-decimal list-inside">
          <li>Inicia sesión en el portal Logitech Sync (<code>sync.logitech.com</code>)</li>
          <li>Ve a Organización → Configuración de API</li>
          <li>Genera un par de certificados cliente (mTLS)</li>
          <li>Descarga <code>certificate.pem</code> y <code>privateKey.pem</code></li>
          <li>Pega el contenido de cada archivo en los campos de arriba</li>
        </ol>
      </details>
    </div>
  )
}
