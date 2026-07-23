-- ============================================================
-- MIGRACIÓN 017 — MÓDULO DE MOVIMIENTOS DE CUENTA
-- Libro unificado de entradas/salidas con clasificación,
-- cuentas bancarias, categorías propias y recurrencia.
-- ============================================================

-- Cuentas (bancos / cajas)
CREATE TABLE IF NOT EXISTS public.cuentas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  tipo          text DEFAULT 'banco',   -- banco | corriente | ahorros | efectivo | otro
  saldo_inicial numeric DEFAULT 0,
  activo        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Categorías de movimiento (predefinidas + propias del tenant)
CREATE TABLE IF NOT EXISTS public.movimiento_categorias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  clase      text DEFAULT 'operacional',  -- operacional | administrativo | financiero | proyecto | otro
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Movimientos (libro de entradas y salidas)
CREATE TABLE IF NOT EXISTS public.movimientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cuenta_id     uuid REFERENCES public.cuentas(id) ON DELETE SET NULL,
  fecha         date NOT NULL DEFAULT CURRENT_DATE,
  tipo          text NOT NULL DEFAULT 'salida',   -- entrada | salida
  monto         numeric NOT NULL DEFAULT 0,
  concepto      text,
  clasificacion text DEFAULT 'operacional',       -- operacional | administrativo | financiero | proyecto | otro
  categoria_id  uuid REFERENCES public.movimiento_categorias(id) ON DELETE SET NULL,
  proyecto_id   uuid REFERENCES public.proyectos(id) ON DELETE SET NULL,
  recurrente    boolean DEFAULT false,            -- se repite cada mes → se proyecta en flujo de caja
  soporte_url   text,
  created_by    uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_tenant_fecha
  ON public.movimientos (tenant_id, fecha DESC);

-- Categorías por defecto para cada tenant existente
INSERT INTO public.movimiento_categorias (tenant_id, nombre, clase)
SELECT t.id, c.nombre, c.clase
FROM public.tenants t
CROSS JOIN (VALUES
  ('Servicios públicos',        'operacional'),
  ('Arriendo',                  'operacional'),
  ('Nómina',                    'operacional'),
  ('Insumos / Compras',         'operacional'),
  ('Transporte / Logística',    'operacional'),
  ('Ingreso por venta',         'operacional'),
  ('Software y suscripciones',  'administrativo'),
  ('Contabilidad / Legal',      'administrativo'),
  ('Comisiones bancarias',      'financiero'),
  ('Impuestos',                 'financiero'),
  ('Otro',                      'otro')
) AS c(nombre, clase)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.cuentas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimiento_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos           ENABLE ROW LEVEL SECURITY;
