-- ============================================================
-- MIGRACIÓN 023 — Venta directa vs Proyecto
-- No toda venta requiere etapa de proyecto: puede ser venta
-- directa de producto. Se elige al generar la orden.
-- Además, un movimiento puede asociarse a una venta directa.
-- ============================================================

ALTER TABLE public.ordenes_ejecucion
  ADD COLUMN IF NOT EXISTS tipo_venta text DEFAULT 'proyecto';   -- proyecto | directa

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS orden_ejecucion_id uuid
  REFERENCES public.ordenes_ejecucion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_oe
  ON public.movimientos (tenant_id, orden_ejecucion_id);
