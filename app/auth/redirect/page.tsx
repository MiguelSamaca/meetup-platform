import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuthRedirectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  redirect(profile?.rol === 'admin' ? '/admin' : '/portal')
}
