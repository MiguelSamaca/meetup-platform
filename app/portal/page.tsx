import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Portal de clientes</h1>
        <p className="text-gray-500 mt-2">Próximamente disponible.</p>
      </div>
    </main>
  )
}
