-- Ejecutar en Supabase Dashboard → SQL Editor

-- 1. Agregar columna storage_path a evidencias
alter table public.evidencias
  add column if not exists storage_path text;

-- 2. Crear bucket de Storage para evidencias
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  true,
  52428800,  -- 50 MB
  null       -- todos los tipos de archivo
)
on conflict (id) do nothing;
