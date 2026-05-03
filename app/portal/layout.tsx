import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PortalNav from '@/components/portal/PortalNav'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.rol === 'admin') redirect('/admin')

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalNav nombre={profile.nombre} />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
