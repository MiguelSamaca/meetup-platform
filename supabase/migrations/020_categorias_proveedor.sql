-- ============================================================
-- MIGRACIÓN 020 — Categorías de proveedor (salidas)
-- Para clasificar anticipos y pagos a proveedores.
-- ============================================================

INSERT INTO public.movimiento_categorias (tenant_id, nombre, clase)
SELECT t.id, c.nombre, c.clase
FROM public.tenants t
CROSS JOIN (VALUES
  ('Anticipo a proveedor', 'proyecto'),
  ('Pago a proveedor',     'proyecto'),
  ('Compra a proveedor',   'operacional')
) AS c(nombre, clase)
ON CONFLICT DO NOTHING;
