-- Asegura que las columnas existen (idempotente)
ALTER TABLE public.oe_items
  ADD COLUMN IF NOT EXISTS precio_unitario numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento       numeric(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_unitario  numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moneda_costo    text          DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS trm             numeric(10,2);

-- Backfill: copia costos de cotizacion_items → oe_items
-- Se empareja por "orden" (mismo índice de fila que se copió al crear la OE)
UPDATE public.oe_items oi
SET
  costo_unitario  = ci.costo_unitario,
  moneda_costo    = COALESCE(ci.moneda_costo, 'COP'),
  trm             = ci.trm,
  precio_unitario = ci.precio_unitario,
  descuento       = COALESCE(ci.descuento, 0)
FROM public.ordenes_ejecucion oe
JOIN public.cotizacion_items ci
  ON  ci.cotizacion_id = oe.cotizacion_id
  AND ci.orden         = oi.orden
WHERE oi.orden_ejecucion_id = oe.id
  AND (oi.costo_unitario IS NULL OR oi.costo_unitario = 0);

-- Auto-crear / actualizar oe_proveedores con los costos reales por proveedor
INSERT INTO public.oe_proveedores (orden_ejecucion_id, proveedor, monto_orden, anticipo_monto)
SELECT
  oi.orden_ejecucion_id,
  oi.proveedor,
  ROUND(SUM(
    oi.cantidad * CASE WHEN oi.moneda_costo = 'USD' THEN oi.costo_unitario * COALESCE(oi.trm, 1) ELSE oi.costo_unitario END
  )) AS monto_orden,
  0 AS anticipo_monto
FROM public.oe_items oi
WHERE oi.proveedor IS NOT NULL
  AND oi.costo_unitario > 0
GROUP BY oi.orden_ejecucion_id, oi.proveedor
ON CONFLICT (orden_ejecucion_id, proveedor)
DO UPDATE SET
  monto_orden = EXCLUDED.monto_orden
WHERE oe_proveedores.monto_orden = 0;
