-- ============================================================
-- MIGRACIÓN 025 — Clasificación "Ventas"
-- Mueve las categorías de venta de la clase 'proyecto' a 'ventas'
-- para que aparezcan al elegir la clasificación Ventas.
-- ============================================================

UPDATE public.movimiento_categorias
SET clase = 'ventas'
WHERE clase = 'proyecto'
  AND nombre IN ('Venta de productos', 'Venta de servicios', 'Servicios', 'Ingreso por venta');
