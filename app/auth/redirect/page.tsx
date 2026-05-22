import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'

export default async function AuthRedirectPage() {
  const profile = await getCurrentProfile()

  if (!profile) redirect('/login')

  if (profile.rol === 'superadmin') redirect('/superadmin')
  if (profile.rol === 'admin')      redirect('/admin')
  redirect('/portal')
}
