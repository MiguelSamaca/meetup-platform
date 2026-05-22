import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const data = await request.formData()

    const nombreEmpresa = (data.get('nombre_empresa') as string)?.trim()
    const nombreAdmin   = (data.get('nombre_admin') as string)?.trim()
    const email         = (data.get('email') as string)?.trim()
    const password      = data.get('password') as string

    if (!nombreEmpresa || !nombreAdmin || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verificar que el email no esté en uso
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese correo electrónico' }, { status: 400 })
    }

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
      return NextResponse.json({ error: tenantError?.message ?? 'Error creando la empresa' }, { status: 500 })
    }

    // 2. Crear usuario admin en Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombreAdmin, rol: 'admin', tenant_id: tenant.id },
    })

    if (authError || !authData.user) {
      await admin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: authError?.message ?? 'Error creando usuario' }, { status: 500 })
    }

    // 3. Crear perfil con tenant_id
    const { error: profileError } = await admin.from('profiles').upsert({
      id: authData.user.id,
      nombre: nombreAdmin,
      email,
      rol: 'admin',
      tenant_id: tenant.id,
      activo: true,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      await admin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
