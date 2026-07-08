import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'

const LOGITECH_SYNC_BASE = 'https://api.sync.logitech.com'

// Vercel Cron o llamada manual autenticada con CRON_SECRET
function isAuthorized(req: NextRequest): boolean {
  const auth   = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  // Sin secret configurado: permitir solo en desarrollo, nunca en producción
  if (!secret) return process.env.NODE_ENV !== 'production'
  return auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req, req.headers.get('x-tenant-id') ?? undefined)
}

async function handler(req: NextRequest, forceTenantId?: string) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Cargar configs de tenants que tienen mTLS configurado
  const query = admin
    .from('logitech_org_config')
    .select('tenant_id, logitech_org_id, cert_pem, private_key_pem, polling_interval_sec')
    .not('cert_pem', 'is', null)
    .not('private_key_pem', 'is', null)

  if (forceTenantId) query.eq('tenant_id', forceTenantId)

  const { data: configs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!configs || configs.length === 0) {
    return NextResponse.json({ ok: true, message: 'No configs' })
  }

  const results: { tenant_id: string; status: string; rooms?: number }[] = []

  for (const cfg of configs) {
    try {
      const syncedRooms = await syncTenant(admin, cfg)
      await admin
        .from('logitech_org_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('tenant_id', cfg.tenant_id)
      results.push({ tenant_id: cfg.tenant_id, status: 'ok', rooms: syncedRooms })
    } catch (e: unknown) {
      results.push({ tenant_id: cfg.tenant_id, status: `error: ${String(e)}` })
    }
  }

  return NextResponse.json({ ok: true, results })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sincroniza salas y dispositivos de un tenant contra Logitech Sync Cloud API
// ─────────────────────────────────────────────────────────────────────────────
async function syncTenant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  cfg: {
    tenant_id:       string
    logitech_org_id: string
    cert_pem:        string
    private_key_pem: string
  }
): Promise<number> {
  // Importación dinámica de undici para mTLS.
  // El certificado de cliente se envía vía Agent (dispatcher); NO como opción
  // de request() — allí `connect` se ignora y el mTLS no se aplicaría.
  const { Agent, request } = await import('undici')
  const dispatcher = new Agent({
    connect: { cert: cfg.cert_pem, key: cfg.private_key_pem },
  })
  const tlsOptions = { dispatcher }

  // Una sola llamada: /org/{orgId}/place devuelve salas con dispositivos embebidos.
  const placesRes = await request(
    `${LOGITECH_SYNC_BASE}/v1/org/${cfg.logitech_org_id}/place`,
    { method: 'GET', ...tlsOptions }
  )
  const placesBody = await placesRes.body.json() as { places?: LogitechPlace[] }
  const places: LogitechPlace[] = placesBody.places ?? []

  for (const place of places) {
    await admin.from('logitech_rooms').upsert(
      {
        tenant_id:        cfg.tenant_id,
        logitech_place_id: place.id,
        name:             place.name ?? null,
        type:             place.type ?? 'Room',
        location:         place.location ?? place.group ?? null,
        capacity:         place.seatCount ?? null,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'tenant_id,logitech_place_id' }
    )

    const { data: room } = await admin
      .from('logitech_rooms')
      .select('id')
      .eq('tenant_id', cfg.tenant_id)
      .eq('logitech_place_id', place.id)
      .maybeSingle()

    if (!room) continue

    for (const dev of place.devices ?? []) {
      const isOnline = dev.status === 'Online' || dev.status === 'InUse'
      const warrantyExpISO = dev.warranty?.expiresAt
        ? new Date(dev.warranty.expiresAt).toISOString().slice(0, 10)
        : null

      await admin.from('logitech_devices').upsert(
        {
          room_id:           room.id,
          tenant_id:         cfg.tenant_id,
          logitech_device_id: dev.id,
          name:              dev.name ?? null,
          model_name:        dev.name ?? null,
          serial_number:     dev.serial ?? null,
          firmware_version:  dev.version ?? null,
          is_online:         isOnline,
          warranty_status:   dev.warranty?.type ?? null,
          warranty_expires:  warrantyExpISO,
          ip_address:        dev.network?.ip ?? null,
          mac_address:       dev.network?.mac ?? null,
          temperature:       dev.sensors?.temperature ?? null,
          humidity:          dev.sensors?.humidity ?? null,
          updated_at:        new Date().toISOString(),
        },
        { onConflict: 'tenant_id,logitech_device_id' }
      )

      const { data: device } = await admin
        .from('logitech_devices')
        .select('id')
        .eq('tenant_id', cfg.tenant_id)
        .eq('logitech_device_id', dev.id)
        .maybeSingle()

      if (device) {
        await admin.from('logitech_device_snapshots').insert({
          device_id:    device.id,
          is_online:    isOnline,
          device_state: dev.status ?? null,
          temperature:  dev.sensors?.temperature ?? null,
          humidity:     dev.sensors?.humidity ?? null,
          captured_at:  new Date().toISOString(),
        })

        // Alerta: dispositivo offline o en estado de error
        if (dev.status === 'Offline') {
          await upsertAlerta(admin, cfg.tenant_id, device.id, 'offline', 'high',
            `${dev.name ?? 'Dispositivo'} está offline`)
        } else if (dev.healthStatus === 'Error') {
          await upsertAlerta(admin, cfg.tenant_id, device.id, 'health', 'high',
            `${dev.name ?? 'Dispositivo'} reporta un error de salud`)
        }

        // Alerta: garantía por vencer (< 60 días) o vencida
        if (dev.warranty?.expiresAt) {
          const diasRestantes = Math.floor((dev.warranty.expiresAt - Date.now()) / 86400000)
          if (diasRestantes < 0) {
            await upsertAlerta(admin, cfg.tenant_id, device.id, 'warranty_expired', 'high',
              `Garantía de ${dev.name ?? 'dispositivo'} vencida`)
          } else if (diasRestantes < 60) {
            await upsertAlerta(admin, cfg.tenant_id, device.id, 'warranty_expiring', 'medium',
              `Garantía de ${dev.name ?? 'dispositivo'} vence en ${diasRestantes} días`)
          }
        }
      }
    }
  }

  return places.length
}

async function upsertAlerta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  tenant_id: string,
  device_id: string,
  type: string,
  severity: string,
  message: string
) {
  // Solo crear si no existe ya una no resuelta del mismo tipo/device
  const { data: existing } = await admin
    .from('logitech_alerts')
    .select('id')
    .eq('tenant_id', tenant_id)
    .eq('device_id', device_id)
    .eq('type', type)
    .is('resolved_at', null)
    .maybeSingle()

  if (!existing) {
    await admin.from('logitech_alerts').insert({
      tenant_id, device_id, type, severity, message,
    })
  }
}

// ─── Types de la Logitech Sync Cloud API (v0.1.4) ────────────────────────────
interface LogitechPlace {
  id:         string
  name?:      string
  type?:      string   // Room | Desk
  group?:     string
  location?:  string
  seatCount?: number
  occupancy?: number
  devices?:   LogitechDevice[]
}

interface LogitechDevice {
  id:           string
  type?:        string   // Logitech | Computer | Generic
  name?:        string
  version?:     string   // CollabOS/firmware
  serial?:      string
  status?:      string   // Offline | Online | InUse
  healthStatus?: string  // NoIssues | Warning | Error
  network?:     { ip?: string; mac?: string; hostName?: string }
  sensors?:     { temperature?: number; humidity?: number; co2?: number }
  warranty?:    { type?: string; expiresAt?: number }
  lastSeen?:    number
}
