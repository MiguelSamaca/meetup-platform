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

/* ─────────────────────────────────────────────────────────────
   PRUEBA EN VIVO (demo) — muestra el llamado a la API y los datos
   crudos recolectados, para presentar al cliente en la reunión.
───────────────────────────────────────────────────────────── */
export interface DemoResultado {
  ok:         boolean
  request?:   { method: string; url: string; auth: string }
  status?:    number
  durationMs?: number
  raw?:       string
  parsed?:    unknown
  error?:     string
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text) } catch { return undefined }
}

// Prueba la Sync Cloud API (nube-a-nube, mTLS) con los certificados configurados
export async function probarConexionSyncDemo(): Promise<DemoResultado> {
  const profile = await requireAdmin()
  const admin   = createAdminClient()

  const { data: cfg } = await admin
    .from('logitech_org_config')
    .select('logitech_org_id, cert_pem, private_key_pem')
    .eq('tenant_id', profile.tenant_id!)
    .maybeSingle()

  if (!cfg?.cert_pem || !cfg?.private_key_pem) {
    return { ok: false, error: 'Certificados mTLS no configurados. Cárgalos en Configuración.' }
  }

  const apiServer = process.env.LOGI_API_SERVER || 'https://api.sync.logitech.com/v1'
  const url = `${apiServer}/orgs/${cfg.logitech_org_id}/places`
  const req = { method: 'GET', url, auth: 'mTLS (certificado de cliente)' }

  const { Agent, request } = await import('undici')
  const dispatcher = new Agent({ connect: { cert: cfg.cert_pem, key: cfg.private_key_pem } })
  const t0 = Date.now()
  try {
    const res  = await request(url, {
      method: 'GET',
      dispatcher,
      headers: { accept: 'application/json' },
    })
    const body = await res.body.text()
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      request: req,
      status: res.statusCode,
      durationMs: Date.now() - t0,
      raw: body.slice(0, 4000),
      parsed: safeParse(body),
    }
  } catch (e: unknown) {
    return { ok: false, request: req, error: String(e), durationMs: Date.now() - t0 }
  }
}

// Prueba la API local de CollabOS (LNA) contra un dispositivo en la red local.
// Requiere ejecutarse desde un equipo con acceso a la subred del dispositivo.
export async function probarConexionLNADemo(input: {
  url:    string
  user?:  string
  pass?:  string
  token?: string
}): Promise<DemoResultado> {
  await requireAdmin()

  if (!input.url || !/^https?:\/\//i.test(input.url)) {
    return { ok: false, error: 'URL inválida. Ej: https://192.168.1.50/status' }
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  let authLabel = 'ninguna'
  if (input.token) {
    headers.authorization = `Bearer ${input.token}`
    authLabel = 'Bearer token'
  } else if (input.user) {
    headers.authorization = 'Basic ' + Buffer.from(`${input.user}:${input.pass ?? ''}`).toString('base64')
    authLabel = 'Basic (usuario/contraseña)'
  }
  const req = { method: 'GET', url: input.url, auth: authLabel }

  const { Agent, request } = await import('undici')
  // Dispositivos locales usan certificado propio; se acepta en la red de confianza.
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false } })
  const t0 = Date.now()
  try {
    const res = await request(input.url, {
      method: 'GET',
      headers,
      dispatcher,
    })
    const body = await res.body.text()
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      request: req,
      status: res.statusCode,
      durationMs: Date.now() - t0,
      raw: body.slice(0, 4000),
      parsed: safeParse(body),
    }
  } catch (e: unknown) {
    return { ok: false, request: req, error: String(e), durationMs: Date.now() - t0 }
  }
}
