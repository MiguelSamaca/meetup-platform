-- ─────────────────────────────────────────────
-- 004_audit_logs.sql
-- Historial de auditoría de la plataforma
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Quién
  tenant_id    UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id      UUID        REFERENCES auth.users(id)    ON DELETE SET NULL,
  user_email   TEXT,
  user_nombre  TEXT,

  -- Qué
  accion       TEXT        NOT NULL,          -- 'login', 'crear_cotizacion', etc.
  entidad      TEXT,                          -- 'cotizacion', 'producto', 'contacto'…
  entidad_id   TEXT,                          -- UUID/consecutivo del registro afectado

  -- Contexto
  detalles     JSONB,                         -- metadata libre (nombre del registro, etc.)
  resultado    TEXT        DEFAULT 'exito'    CHECK (resultado IN ('exito', 'error')),
  error_msg    TEXT
);

-- Índices para filtros comunes
CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx    ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx      ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_accion_idx       ON public.audit_logs (accion);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx   ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resultado_idx    ON public.audit_logs (resultado);

-- Solo superadmin puede leer logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_read_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol = 'superadmin'
    )
  );

-- Las inserciones van siempre por service role (server-side), nunca por el cliente
-- Por eso no necesitamos policy INSERT para authenticated
