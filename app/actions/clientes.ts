'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id) {
    throw new Error('No autorizado')
  }
  return profile
}

export async function crearCliente(formData: FormData) {
  const profile    = await requireAdmin()
  const nombre     = formData.get('nombre') as string
  const email      = formData.get('email') as string
  const empresa_id = formData.get('empresa_id') as string
  const telefono   = formData.get('telefono') as string
  const password   = formData.get('password') as string

  if (!empresa_id) throw new Error('Debes seleccionar una empresa')

  const admin = createAdminClient()

  // Verificar que la empresa pertenece al tenant del admin
  const { data: empresa } = await admin
    .from('empresas')
    .select('nombre')
    .eq('id', empresa_id)
    .eq('tenant_id', profile.tenant_id!)
    .single()

  if (!empresa) throw new Error('Empresa no encontrada en tu cuenta')

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, empresa: empresa.nombre, rol: 'cliente' },
  })

  if (authError || !authData.user) throw new Error(authError?.message ?? 'Error creando usuario')

  await admin.from('profiles').upsert({
    id: authData.user.id,
    nombre,
    email,
    empresa: empresa.nombre,
    empresa_id,
    tenant_id: profile.tenant_id,
    telefono: telefono || null,
    rol: 'cliente',
    activo: true,
  })

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'crear_cliente',
    entidad:    'cliente',
    entidadId:  authData.user.id,
    detalles:   { nombre, email, empresa: empresa.nombre },
  })

  revalidatePath('/admin/clientes')
  redirect('/admin/clientes')
}

export async function editarCliente(id: string, formData: FormData) {
  const profile    = await requireAdmin()
  const admin      = createAdminClient()
  const nombre     = formData.get('nombre') as string
  const empresa_id = formData.get('empresa_id') as string
  const telefono   = formData.get('telefono') as string
  const activo     = formData.get('activo') === 'true'

  if (!empresa_id) throw new Error('Debes seleccionar una empresa')

  const { data: empresa } = await admin
    .from('empresas')
    .select('nombre')
    .eq('id', empresa_id)
    .eq('tenant_id', profile.tenant_id!)
    .single()

  if (!empresa) throw new Error('Empresa no encontrada en tu cuenta')

  const { error } = await admin
    .from('profiles')
    .update({ nombre, empresa: empresa.nombre, empresa_id, telefono: telefono || null, activo })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  await logAudit({
    tenantId:   profile.tenant_id,
    userId:     profile.id,
    userNombre: profile.nombre,
    accion:     'editar_cliente',
    entidad:    'cliente',
    entidadId:  id,
    detalles:   { nombre, empresa: empresa.nombre, activo },
  })

  revalidatePath('/admin/clientes')
  redirect('/admin/clientes')
}

export async function eliminarCliente(id: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  await Promise.all([
    admin.from('proyectos').update({ cliente_id: null }).eq('cliente_id', id),
    admin.from('tickets').update({ cliente_id: null }).eq('cliente_id', id),
  ])

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/clientes')
  redirect('/admin/clientes')
}
