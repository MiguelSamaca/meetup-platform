'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Registra una nueva empresa integradora (tenant) con su primer administrador.
 * No requiere autenticación previa — es el flujo de onboarding público.
 */
export async function registrarEmpresaIntegradora(formData: FormData) {
  const nombreEmpresa = (formData.get('nombre_empresa') as string)?.trim()
  const nombreAdmin   = (formData.get('nombre_admin') as string)?.trim()
  const email         = (formData.get('email') as string)?.trim()
  const password      = formData.get('password') as string

  if (!nombreEmpresa || !nombreAdmin || !email || !password) {
    throw new Error('Todos los campos son obligatorios')
  }
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres')
  }

  const admin = createAdminClient()

  // 1. Crear el tenant
  const slug = nombreEmpresa
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ nombre: nombreEmpresa, slug })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    throw new Error(tenantError?.message ?? 'Error creando la empresa')
  }

  // 2. Crear el usuario admin en Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombreAdmin, rol: 'admin', tenant_id: tenant.id },
  })

  if (authError || !authData.user) {
    // Revertir: eliminar tenant si el usuario no se pudo crear
    await admin.from('tenants').delete().eq('id', tenant.id)
    throw new Error(authError?.message ?? 'Error creando usuario administrador')
  }

  // 3. Crear el perfil del admin con tenant_id
  const { error: profileError } = await admin.from('profiles').upsert({
    id: authData.user.id,
    nombre: nombreAdmin,
    email,
    rol: 'admin',
    tenant_id: tenant.id,
    activo: true,
  })

  if (profileError) {
    // Revertir ambos
    await admin.auth.admin.deleteUser(authData.user.id)
    await admin.from('tenants').delete().eq('id', tenant.id)
    throw new Error(profileError.message)
  }

  redirect('/login?registered=empresa')
}
