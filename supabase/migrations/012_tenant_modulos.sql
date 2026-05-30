-- Módulos habilitados por tenant
-- Valores: empresas, contactos, clientes, proyectos, cotizaciones, ordenes, productos, tickets
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS modulos text[] DEFAULT ARRAY['empresas','contactos','clientes','proyectos','cotizaciones','ordenes','productos','tickets'];

UPDATE public.tenants
SET modulos = ARRAY['empresas','contactos','clientes','proyectos','cotizaciones','ordenes','productos','tickets']
WHERE modulos IS NULL;
