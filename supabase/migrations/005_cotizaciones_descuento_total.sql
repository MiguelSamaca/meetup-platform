-- Agrega columna independiente para controlar visibilidad del descuento total en el PDF
-- La columna existente mostrar_descuento controla la columna Desc. % por producto
-- Esta nueva columna controla las filas de resumen (Subtotal bruto, Descuento) en el pie de tabla

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS mostrar_descuento_total boolean NOT NULL DEFAULT true;
