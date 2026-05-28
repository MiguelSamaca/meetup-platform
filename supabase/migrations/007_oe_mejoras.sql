-- Dos fechas por ítem: solicitud al proveedor y entrega en bodega
ALTER TABLE public.oe_items
  ADD COLUMN IF NOT EXISTS fecha_solicitud date,
  ADD COLUMN IF NOT EXISTS fecha_entrega   date;

-- Mover eta existente a fecha_entrega
UPDATE public.oe_items SET fecha_entrega = eta WHERE eta IS NOT NULL AND fecha_entrega IS NULL;

-- Tabla de montos financieros por proveedor dentro de una OE
CREATE TABLE IF NOT EXISTS public.oe_proveedores (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_ejecucion_id  uuid NOT NULL,
  proveedor           text NOT NULL,
  monto_orden         numeric(15,2) NOT NULL DEFAULT 0,
  anticipo_monto      numeric(15,2) NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (orden_ejecucion_id, proveedor)
);

ALTER TABLE public.oe_proveedores ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS oe_proveedores_oe_idx ON public.oe_proveedores(orden_ejecucion_id);
