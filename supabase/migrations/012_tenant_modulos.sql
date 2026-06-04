-- Módulos habilitados por tenant
-- Valores: empresas, contactos, clientes, proyectos, cotizaciones, ordenes, productos, tickets, finanzas
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS modulos text[] DEFAULT ARRAY['empresas','contactos','clientes','proyectos','cotizaciones','ordenes','productos','tickets','finanzas'];

UPDATE public.tenants
SET modulos = ARRAY['empresas','contactos','clientes','proyectos','cotizaciones','ordenes','productos','tickets','finanzas']
WHERE modulos IS NULL;
