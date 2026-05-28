-- Costos de cotización copiados a oe_items para calcular monto por proveedor
ALTER TABLE public.oe_items
  ADD COLUMN IF NOT EXISTS precio_unitario numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento       numeric(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_unitario  numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moneda_costo    text          DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS trm             numeric(10,2);
