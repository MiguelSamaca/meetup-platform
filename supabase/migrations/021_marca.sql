-- ============================================================
-- MIGRACIÓN 021 — Campo Marca (separado de Proveedor)
-- Marca = fabricante del producto (McIntosh, B&W).
-- Proveedor = distribuidor a quien se le compra (Audio Concept…).
-- ============================================================

ALTER TABLE public.productos        ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE public.cotizacion_items ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE public.oe_items         ADD COLUMN IF NOT EXISTS marca text;
