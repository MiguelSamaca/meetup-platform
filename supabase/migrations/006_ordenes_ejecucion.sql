-- Órdenes de Ejecución: se crean al aprobar una cotización
CREATE TABLE IF NOT EXISTS public.ordenes_ejecucion (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  cotizacion_id         uuid NOT NULL,
  contacto_id           uuid NOT NULL,
  consecutivo           text NOT NULL,
  estado                text NOT NULL DEFAULT 'activa',  -- activa | completada
  total_cotizacion      numeric(15,2) NOT NULL DEFAULT 0,
  anticipo_porcentaje   numeric(5,2)  NOT NULL DEFAULT 50,
  anticipo_monto        numeric(15,2) NOT NULL DEFAULT 0,
  anticipo_fecha        date,
  anticipo_recibido     boolean NOT NULL DEFAULT false,
  saldo_fecha           date,
  saldo_recibido        boolean NOT NULL DEFAULT false,
  notas                 text,
  created_at            timestamptz DEFAULT now(),
  completed_at          timestamptz
);

-- Ítems copiados de la cotización + campos operativos
CREATE TABLE IF NOT EXISTS public.oe_items (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_ejecucion_id        uuid NOT NULL,
  proveedor                 text,
  referencia                text,
  descripcion               text NOT NULL,
  cantidad                  numeric NOT NULL DEFAULT 1,
  estado                    text NOT NULL DEFAULT 'pendiente', -- pendiente | pedido | recibido
  eta                       date,
  anticipo_proveedor_pagado boolean NOT NULL DEFAULT false,
  orden                     integer NOT NULL DEFAULT 0,
  created_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oe_tenant_idx         ON public.ordenes_ejecucion(tenant_id);
CREATE INDEX IF NOT EXISTS oe_cotizacion_idx     ON public.ordenes_ejecucion(cotizacion_id);
CREATE INDEX IF NOT EXISTS oe_estado_idx         ON public.ordenes_ejecucion(estado);
CREATE INDEX IF NOT EXISTS oe_items_orden_idx    ON public.oe_items(orden_ejecucion_id);

ALTER TABLE public.ordenes_ejecucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oe_items          ENABLE ROW LEVEL SECURITY;
-- El service-role (createAdminClient) bypasea RLS; no se necesitan policies adicionales.
