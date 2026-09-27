-- ============================================================
-- MIGRACIÓN 026 — Categorías de proveedor también en Ventas
-- En una venta directa también se paga al proveedor, así que
-- estas categorías deben estar disponibles en clase 'ventas'.
-- ============================================================

INSERT INTO public.movimiento_categorias (tenant_id, nombre, clase)
SELECT t.id, c.nombre, 'ventas'
FROM public.tenants t
CROSS JOIN (VALUES
  ('Pago a proveedor'),
  ('Anticipo a proveedor'),
  ('Compra a proveedor')
) AS c(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.movimiento_categorias mc
  WHERE mc.tenant_id = t.id AND mc.nombre = c.nombre AND mc.clase = 'ventas'
);
