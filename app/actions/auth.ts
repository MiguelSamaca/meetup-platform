'use server'

import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'

export async function login(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const cookieStore = await cookies()
  const email = formData.get('email') as string

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get('password') as string,
  })

  if (error || !data.user) {
    await logAudit({
      accion:     'login_fallido',
      userEmail:  email,
      resultado:  'error',
      errorMsg:   error?.message ?? 'Credenciales incorrectas',
      detalles:   { email },
    })
    return { error: 'Correo o contraseña incorrectos.' }
  }

  // Admin client bypasea RLS — no depende de cookies ni JWT forwarding
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('rol, tenant_id, nombre')
    .eq('id', data.user.id)
    .single()

  await logAudit({
    accion:      'login',
    userId:      data.user.id,
    userEmail:   email,
    userNombre:  profile?.nombre ?? null,
    tenantId:    profile?.tenant_id ?? null,
    resultado:   'exito',
    detalles:    { rol: profile?.rol },
  })

  if (profile?.rol === 'superadmin') redirect('/superadmin')
  if (profile?.rol === 'admin')      redirect('/admin')
  redirect('/portal')
}
