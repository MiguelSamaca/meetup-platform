'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function crearCliente(formData: FormData) {
  const nombre   = formData.get('nombre') as string
  const email    = formData.get('email') as string
  const empresa  = formData.get('empresa') as string
  const telefono = formData.get('telefono') as string
  const password = formData.get('password') as string

  const admin = createAdminClient()

  // Crear usuario en auth con la admin API
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, empresa, rol: 'cliente' },
  })

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'Error creando usuario')
  }

  // Upsert del perfil (el trigger lo crea, pero aseguramos los campos extra)
  await admin.from('profiles').upsert({
    id: authData.user.id,
    nombre,
    email,
    empresa: empresa || null,
    telefono: telefono || null,
    rol: 'cliente',
    activo: true,
  })

  revalidatePath('/admin/clientes')
  redirect('/admin/clientes')
}
