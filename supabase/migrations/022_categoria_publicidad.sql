-- ============================================================
-- MIGRACIÓN 022 — Categoría Publicidad (operacional)
-- ============================================================

INSERT INTO public.movimiento_categorias (tenant_id, nombre, clase)
SELECT t.id, 'Publicidad', 'operacional'
FROM public.tenants t
ON CONFLICT DO NOTHING;
