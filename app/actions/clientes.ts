'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export async function crearCliente(formData: FormData) {
  const nombre   = formData.get('nombre') as string
  const email    = formData.get('email') as string
  const empresa  = formData.get('empresa') as string
  const telefono = formData.get('telefono') as string
  const password = formData.get('password') as string

  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, empresa, rol: 'cliente' },
  })

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'Error creando usuario')
  }

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

export async function editarCliente(id: string, formData: FormData) {
  const admin = createAdminClient()

  const nombre   = formData.get('nombre') as string
  const empresa  = formData.get('empresa') as string
  const telefono = formData.get('telefono') as string
  const activo   = formData.get('activo') === 'true'

  const { error } = await admin
    .from('profiles')
    .update({ nombre, empresa: empresa || null, telefono: telefono || null, activo })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/clientes')
  redirect('/admin/clientes')
}

export async function eliminarCliente(id: string) {
  const admin = createAdminClient()

  // Nullificar referencias antes de borrar para evitar errores de FK
  await Promise.all([
    admin.from('proyectos').update({ cliente_id: null }).eq('cliente_id', id),
    admin.from('tickets').update({ cliente_id: null }).eq('cliente_id', id),
  ])

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/clientes')
  redirect('/admin/clientes')
}
