-- ============================================================
-- MIGRACIÓN 019 — Categorías de venta (ingresos de proyecto)
-- Para clasificar los ingresos por venta de productos y servicios.
-- ============================================================

INSERT INTO public.movimiento_categorias (tenant_id, nombre, clase)
SELECT t.id, c.nombre, c.clase
FROM public.tenants t
CROSS JOIN (VALUES
  ('Venta de productos',  'proyecto'),
  ('Venta de servicios',  'proyecto'),
  ('Servicios',           'proyecto'),
  ('Anticipo de cliente', 'proyecto')
) AS c(nombre, clase)
ON CONFLICT DO NOTHING;
