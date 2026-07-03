-- ============================================================
-- MIGRACIÓN 016 — MÓDULO LOGITECH ROOMS
-- Dashboard de estado de salas de videoconferencia Logitech
-- Se integra con Sync Cloud API (mTLS) y CollabOS API (LAN)
-- ============================================================

-- Configuración Logitech por tenant (credenciales mTLS, org_id de Logitech)
CREATE TABLE IF NOT EXISTS public.logitech_org_config (
  tenant_id           uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  logitech_org_id     text NOT NULL,
  cert_pem            text,    -- Certificado mTLS (sensible — cifrar en prod)
  private_key_pem     text,    -- Llave privada mTLS (sensible — cifrar en prod)
  polling_interval_sec int     DEFAULT 300,   -- 5 min por defecto (Vercel Pro = 1 min)
  collabos_enabled    boolean  DEFAULT false,
  last_sync_at        timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- Salas/espacios sincronizadas desde Sync Cloud API
CREATE TABLE IF NOT EXISTS public.logitech_rooms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  logitech_place_id   text NOT NULL,
  name                text,
  type                text DEFAULT 'Room',   -- Room | Desk | Floor | Building
  location            text,
  capacity            int,
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (tenant_id, logitech_place_id)
);

-- Dispositivos por sala
CREATE TABLE IF NOT EXISTS public.logitech_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid REFERENCES public.logitech_rooms(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  logitech_device_id  text,
  name                text,
  model_name          text,
  serial_number       text,
  firmware_version    text,
  is_online           boolean DEFAULT false,
  warranty_status     text,    -- Active | Expired | Unknown
  warranty_expires    date,
  ip_address          text,
  mac_address         text,
  temperature         float,
  humidity            float,
  collabos_enabled    boolean DEFAULT false,
  lna_user            text,
  lna_pass            text,    -- sensible — cifrar en prod
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (tenant_id, logitech_device_id)
);

-- Histórico de estados (snapshot en cada polling)
CREATE TABLE IF NOT EXISTS public.logitech_device_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       uuid NOT NULL REFERENCES public.logitech_devices(id) ON DELETE CASCADE,
  is_online       boolean,
  device_state    text,    -- Idle | InCall | Standby | Booting
  mic_state       text,
  speaker_volume  int,
  temperature     float,
  humidity        float,
  captured_at     timestamptz DEFAULT now()
);

-- Índice para consultas de snapshots recientes
CREATE INDEX IF NOT EXISTS idx_logitech_snapshots_device_time
  ON public.logitech_device_snapshots (device_id, captured_at DESC);

-- Alertas (dispositivo offline, garantía por vencer, etc.)
CREATE TABLE IF NOT EXISTS public.logitech_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id   uuid REFERENCES public.logitech_devices(id) ON DELETE CASCADE,
  type        text NOT NULL,   -- offline | warranty_expiring | warranty_expired | firmware
  severity    text DEFAULT 'medium',  -- high | medium | low
  message     text,
  resolved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- RLS: habilitar en todas las tablas (el service role bypassa)
ALTER TABLE public.logitech_org_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logitech_rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logitech_devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logitech_device_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logitech_alerts          ENABLE ROW LEVEL SECURITY;
