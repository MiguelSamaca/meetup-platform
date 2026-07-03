'use server'

import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id) {
    throw new Error('No autorizado')
  }
  return profile
}

/* ─────────────────────────────────────────────────────────────
   Guardar configuración mTLS + Logitech Org ID
───────────────────────────────────────────────────────────── */
export async function guardarConfigLogitech(formData: FormData) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const logitech_org_id    = formData.get('logitech_org_id') as string
  const cert_pem           = formData.get('cert_pem') as string | null
  const private_key_pem    = formData.get('private_key_pem') as string | null
  const polling_interval_sec = Number(formData.get('polling_interval_sec') ?? 300)

  if (!logitech_org_id) throw new Error('Logitech Org ID requerido')

  const upsertData: Record<string, unknown> = {
    tenant_id: profile.tenant_id,
    logitech_org_id,
    polling_interval_sec,
  }
  if (cert_pem)        upsertData.cert_pem        = cert_pem
  if (private_key_pem) upsertData.private_key_pem = private_key_pem

  const { error } = await admin
    .from('logitech_org_config')
    .upsert(upsertData, { onConflict: 'tenant_id' })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/rooms/configuracion')
}

/* ─────────────────────────────────────────────────────────────
   Forzar sincronización manual (llama al cron endpoint)
───────────────────────────────────────────────────────────── */
export async function forzarSincronizacion(): Promise<{ ok: boolean; mensaje: string }> {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  // Verificar que existe configuración antes de disparar el cron
  const { data: cfg } = await admin
    .from('logitech_org_config')
    .select('logitech_org_id, cert_pem, private_key_pem')
    .eq('tenant_id', profile.tenant_id!)
    .maybeSingle()

  if (!cfg?.cert_pem || !cfg?.private_key_pem) {
    return { ok: false, mensaje: 'Certificado mTLS no configurado' }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/cron/logitech-poll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
        'x-tenant-id': profile.tenant_id!,
      },
    })
    return res.ok
      ? { ok: true, mensaje: 'Sincronización iniciada' }
      : { ok: false, mensaje: `Error del servidor: ${res.status}` }
  } catch (e: unknown) {
    return { ok: false, mensaje: String(e) }
  }
}

/* ─────────────────────────────────────────────────────────────
   Resolver alerta (marcarla como resuelta)
───────────────────────────────────────────────────────────── */
export async function resolverAlerta(alertaId: string) {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const { error } = await admin
    .from('logitech_alerts')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', alertaId)
    .eq('tenant_id', profile.tenant_id!)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/rooms/alertas')
  revalidatePath('/admin/rooms')
}
