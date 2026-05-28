-- Enlazar proyectos con ordenes_ejecucion
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS orden_ejecucion_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS contacto_id        uuid;

-- empresa_id puede ser nulo cuando el proyecto viene de una OE
-- (el contacto puede no tener empresa registrada en el portal)
ALTER TABLE public.proyectos
  ALTER COLUMN empresa_id DROP NOT NULL;
