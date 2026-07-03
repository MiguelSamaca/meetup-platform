import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'

const LOGITECH_SYNC_BASE = 'https://api.sync.logitech.com'

// Vercel Cron o llamada manual autenticada con CRON_SECRET
function isAuthorized(req: NextRequest): boolean {
  const auth   = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret) return true   // dev: no secret configurado
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
  // Importación dinámica de undici para mTLS
  const { request } = await import('undici')

  const tlsOptions = {
    connect: {
      cert: cfg.cert_pem,
      key:  cfg.private_key_pem,
    },
  }

  // 1. Obtener salas (places)
  const placesRes = await request(
    `${LOGITECH_SYNC_BASE}/v1/orgs/${cfg.logitech_org_id}/places`,
    { method: 'GET', ...tlsOptions }
  )
  const placesBody = await placesRes.body.json() as { data?: LogitechPlace[] }
  const places: LogitechPlace[] = placesBody.data ?? []

  for (const place of places) {
    await admin.from('logitech_rooms').upsert(
      {
        tenant_id:        cfg.tenant_id,
        logitech_place_id: place.id,
        name:             place.name,
        type:             place.type ?? 'Room',
        location:         place.location ?? null,
        capacity:         place.capacity ?? null,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'tenant_id,logitech_place_id' }
    )

    // Obtener room_id local
    const { data: room } = await admin
      .from('logitech_rooms')
      .select('id')
      .eq('tenant_id', cfg.tenant_id)
      .eq('logitech_place_id', place.id)
      .maybeSingle()

    if (!room) continue

    // 2. Obtener dispositivos de la sala
    const devRes = await request(
      `${LOGITECH_SYNC_BASE}/v1/orgs/${cfg.logitech_org_id}/places/${place.id}/devices`,
      { method: 'GET', ...tlsOptions }
    )
    const devBody = await devRes.body.json() as { data?: LogitechDevice[] }
    const devices: LogitechDevice[] = devBody.data ?? []

    for (const dev of devices) {
      await admin.from('logitech_devices').upsert(
        {
          room_id:           room.id,
          tenant_id:         cfg.tenant_id,
          logitech_device_id: dev.id,
          name:              dev.name,
          model_name:        dev.modelName ?? null,
          serial_number:     dev.serialNumber ?? null,
          firmware_version:  dev.firmwareVersion ?? null,
          is_online:         dev.isOnline ?? false,
          warranty_status:   dev.warrantyStatus ?? 'Unknown',
          warranty_expires:  dev.warrantyExpirationDate ?? null,
          ip_address:        dev.ipAddress ?? null,
          mac_address:       dev.macAddress ?? null,
          temperature:       dev.temperature ?? null,
          humidity:          dev.humidity ?? null,
          updated_at:        new Date().toISOString(),
        },
        { onConflict: 'tenant_id,logitech_device_id' }
      )

      // Obtener device_id local y guardar snapshot
      const { data: device } = await admin
        .from('logitech_devices')
        .select('id')
        .eq('tenant_id', cfg.tenant_id)
        .eq('logitech_device_id', dev.id)
        .maybeSingle()

      if (device) {
        await admin.from('logitech_device_snapshots').insert({
          device_id:    device.id,
          is_online:    dev.isOnline ?? false,
          device_state: dev.deviceState ?? null,
          temperature:  dev.temperature ?? null,
          humidity:     dev.humidity ?? null,
          captured_at:  new Date().toISOString(),
        })

        // Generar alerta si dispositivo offline
        if (dev.isOnline === false) {
          await upsertAlerta(admin, cfg.tenant_id, device.id, 'offline', 'high',
            `${dev.name ?? 'Dispositivo'} está offline`)
        }

        // Alerta garantía por vencer (< 60 días)
        if (dev.warrantyExpirationDate) {
          const exp = new Date(dev.warrantyExpirationDate)
          const diasRestantes = Math.floor((exp.getTime() - Date.now()) / 86400000)
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

// ─── Types mínimos de la Logitech Sync Cloud API ─────────────────────────────
interface LogitechPlace {
  id:       string
  name:     string
  type?:    string
  location?: string
  capacity?: number
}

interface LogitechDevice {
  id:                     string
  name:                   string
  modelName?:             string
  serialNumber?:          string
  firmwareVersion?:       string
  isOnline?:              boolean
  warrantyStatus?:        string
  warrantyExpirationDate?: string
  ipAddress?:             string
  macAddress?:            string
  temperature?:           number
  humidity?:              number
  deviceState?:           string
}
