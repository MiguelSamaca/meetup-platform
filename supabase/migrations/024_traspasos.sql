-- ============================================================
-- MIGRACIÓN 024 — Traspasos entre cuentas
-- Un traspaso son 2 movimientos (salida de una cuenta, entrada
-- en otra) vinculados por transferencia_id, con clasificación
-- 'traspaso' (no cuenta como ingreso ni gasto real).
-- ============================================================

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS transferencia_id uuid;

CREATE INDEX IF NOT EXISTS idx_movimientos_transferencia
  ON public.movimientos (transferencia_id);
