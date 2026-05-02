'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const cookieStore = await cookies()

  // Cookies nuevas seteadas durante signIn (no están en el request entrante aún)
  const freshCookies: Record<string, string> = {}

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const existing = Object.fromEntries(
            cookieStore.getAll().map(c => [c.name, c.value])
          )
          // freshCookies sobreescribe los existentes → el token de sesión queda disponible
          return Object.entries({ ...existing, ...freshCookies }).map(
            ([name, value]) => ({ name, value })
          )
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            freshCookies[name] = value        // disponible para getAll() inmediatamente
            cookieStore.set(name, value, options) // persistido en la respuesta HTTP
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error || !data.user) {
    return { error: 'Correo o contraseña incorrectos.' }
  }

  // Ahora getAll() devuelve los tokens frescos → auth.uid() funciona en RLS
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', data.user.id)
    .single()

  redirect(profile?.rol === 'admin' ? '/admin' : '/portal')
}
