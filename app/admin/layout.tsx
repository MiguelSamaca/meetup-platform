import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/admin/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  if (!profile) redirect('/login')
  if (profile.rol === 'superadmin') redirect('/superadmin')
  if (profile.rol !== 'admin') redirect('/portal')

  // Cargar color primario del integrador
  const supabase = createAdminClient()
  const { data: config } = await supabase
    .from('tenant_config')
    .select('color_primario')
    .eq('tenant_id', profile.tenant_id!)
    .maybeSingle()

  const brandColor = (config as any)?.color_primario ?? '#059669'

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Inyecta el color como CSS variable global — disponible en toda la plataforma */}
      <style>{`
        :root {
          --brand:       ${brandColor};
          --brand-light: ${brandColor}22;
        }
      `}</style>

      <Sidebar tenantNombre={profile.tenant_nombre} brandColor={brandColor} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
