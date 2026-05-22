import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import SuperAdminSidebar from '@/components/superadmin/Sidebar'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  if (!profile) redirect('/login')
  if (profile.rol !== 'superadmin') redirect('/admin')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
