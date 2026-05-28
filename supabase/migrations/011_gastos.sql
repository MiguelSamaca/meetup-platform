-- Gastos adicionales asociados a un proyecto (solo visibles para admin)
CREATE TABLE IF NOT EXISTS public.gastos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  categoria   text NOT NULL DEFAULT 'otros',
  monto       numeric(15,2) NOT NULL DEFAULT 0,
  factura     text,          -- número o referencia de factura
  soporte_url text,          -- URL del archivo (PDF / imagen)
  fecha       date DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS gastos_proyecto_idx ON public.gastos(proyecto_id);
CREATE INDEX IF NOT EXISTS gastos_tenant_idx   ON public.gastos(tenant_id);
