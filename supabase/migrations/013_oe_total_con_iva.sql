-- Agregar total con IVA a ordenes_ejecucion
-- El total_cotizacion ya existente es ANTES de IVA (precio neto)
-- total_con_iva = total_cotizacion * 1.19 (lo que el cliente realmente paga)

ALTER TABLE public.ordenes_ejecucion
  ADD COLUMN IF NOT EXISTS total_con_iva numeric(15,2);

-- Backfill OEs existentes
UPDATE public.ordenes_ejecucion
SET total_con_iva = ROUND(total_cotizacion * 1.19, 2)
WHERE total_con_iva IS NULL AND total_cotizacion IS NOT NULL;
