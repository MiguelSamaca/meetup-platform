-- Agrega configuración de periodicidad IVA al tenant
-- Cuatrimestral = régimen estándar para facturadores electrónicos < 92,000 UVT
-- Bimestral     = para grandes contribuyentes ≥ 92,000 UVT

ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS iva_periodicidad text DEFAULT 'cuatrimestral';

-- Restricción de valores válidos
ALTER TABLE public.tenant_config
  DROP CONSTRAINT IF EXISTS tenant_config_iva_periodicidad_check;

ALTER TABLE public.tenant_config
  ADD CONSTRAINT tenant_config_iva_periodicidad_check
  CHECK (iva_periodicidad IN ('cuatrimestral', 'bimestral', 'anual'));
