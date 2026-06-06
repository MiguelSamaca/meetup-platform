-- Gastos fijos mensuales recurrentes por tenant
-- Ejemplos: sueldo, celular, transporte, marketing, contabilidad

CREATE TABLE IF NOT EXISTS public.gastos_fijos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  monto       numeric(15,2) NOT NULL DEFAULT 0,
  categoria   text NOT NULL DEFAULT 'operativo',
  -- Categorías: personal | operativo | admin | marketing
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Saldo actual en caja (lo ingresa manualmente el integrador)
ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS saldo_caja_actual numeric(15,2) DEFAULT 0;
