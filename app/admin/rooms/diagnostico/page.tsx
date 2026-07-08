import { getCurrentProfile } from '@/lib/auth'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import DiagnosticoAPI        from '@/components/admin/DiagnosticoAPI'

export const metadata = { title: 'Prueba de conexión | Salas' }

export default async function DiagnosticoPage() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) redirect('/login')
  if (profile.rol !== 'admin' && profile.rol !== 'superadmin') redirect('/admin')

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/rooms" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">
            ← Salas
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Prueba de conexión en vivo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ejecuta los llamados a las APIs y muestra los datos que se recolectan, de forma transparente.
          </p>
        </div>
      </div>

      {/* Nota para la demostración */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Esta pantalla muestra <strong>exactamente qué llamado se hace</strong> a cada API y
        <strong> qué datos devuelve</strong>. Las operaciones son de <strong>solo lectura</strong>:
        no se modifica ni controla ningún equipo.
      </div>

      <DiagnosticoAPI />
    </div>
  )
}
