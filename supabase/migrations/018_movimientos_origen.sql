-- ============================================================
-- MIGRACIÓN 018 — Origen de movimientos (para importación idempotente)
-- Permite importar cobros/gastos existentes sin duplicarlos.
-- ============================================================

ALTER TABLE public.movimientos ADD COLUMN IF NOT EXISTS origen     text;
ALTER TABLE public.movimientos ADD COLUMN IF NOT EXISTS origen_ref text;

CREATE INDEX IF NOT EXISTS idx_movimientos_origen
  ON public.movimientos (tenant_id, origen, origen_ref);
