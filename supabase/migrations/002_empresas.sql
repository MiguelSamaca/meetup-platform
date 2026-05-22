-- ============================================================
-- MIGRACIÓN 002 — EMPRESAS (Multi-tenant)
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. TABLA EMPRESAS
create table if not exists public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  nit        text,
  telefono   text,
  direccion  text,
  activo     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. empresa_id en profiles (reemplaza el campo texto libre)
alter table public.profiles
  add column if not exists empresa_id uuid references public.empresas(id) on delete set null;

-- 3. empresa_id en proyectos (obligatorio — se valida en la app)
alter table public.proyectos
  add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

-- ============================================================
-- RLS — EMPRESAS
-- ============================================================
alter table public.empresas enable row level security;

-- Admin: acceso total
create policy "admin_all_empresas" on public.empresas
  for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'admin'
  ));

-- Cliente: solo ve su propia empresa
create policy "cliente_su_empresa" on public.empresas
  for select
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and empresa_id = empresas.id
  ));

-- ============================================================
-- RLS — PROYECTOS
-- Los clientes ven todos los proyectos de su empresa
-- ============================================================
drop policy if exists "cliente_sus_proyectos" on public.proyectos;

create policy "cliente_sus_proyectos" on public.proyectos
  for select
  using (exists (
    select 1 from public.profiles
    where id = auth.uid()
      and empresa_id = proyectos.empresa_id
  ));

-- ============================================================
-- RLS — ETAPAS
-- ============================================================
drop policy if exists "cliente_sus_etapas" on public.etapas;

create policy "cliente_sus_etapas" on public.etapas
  for select
  using (exists (
    select 1 from public.proyectos p
    join public.profiles pr on pr.empresa_id = p.empresa_id
    where p.id = etapas.proyecto_id
      and pr.id = auth.uid()
  ));

-- ============================================================
-- RLS — EVIDENCIAS
-- ============================================================
drop policy if exists "cliente_sus_evidencias" on public.evidencias;

create policy "cliente_sus_evidencias" on public.evidencias
  for select
  using (exists (
    select 1 from public.etapas e
    join public.proyectos p  on p.id = e.proyecto_id
    join public.profiles pr  on pr.empresa_id = p.empresa_id
    where e.id = evidencias.etapa_id
      and pr.id = auth.uid()
  ));

-- ============================================================
-- RLS — TICKETS
-- Ver: tickets propios O tickets de proyectos de su empresa
-- Crear: solo para proyectos de su empresa
-- ============================================================
drop policy if exists "cliente_sus_tickets"  on public.tickets;
drop policy if exists "cliente_crear_ticket" on public.tickets;

create policy "cliente_sus_tickets" on public.tickets
  for select
  using (
    -- Ticket abierto por el usuario directamente
    cliente_id = auth.uid()
    OR
    -- Ticket de un proyecto que pertenece a la empresa del usuario
    exists (
      select 1 from public.proyectos p
      join public.profiles pr on pr.empresa_id = p.empresa_id
      where p.id = tickets.proyecto_id
        and pr.id = auth.uid()
    )
  );

create policy "cliente_crear_ticket" on public.tickets
  for insert
  with check (
    cliente_id = auth.uid()
    AND (
      -- Sin proyecto: permitido
      proyecto_id is null
      OR
      -- El proyecto debe ser de la empresa del usuario
      exists (
        select 1 from public.proyectos p
        join public.profiles pr on pr.empresa_id = p.empresa_id
        where p.id = tickets.proyecto_id
          and pr.id = auth.uid()
      )
    )
  );

-- ============================================================
-- RLS — TICKET_MENSAJES
-- Ver y responder: todos los usuarios de la empresa pueden
-- interactuar con tickets de proyectos de su empresa
-- ============================================================
drop policy if exists "cliente_sus_mensajes" on public.ticket_mensajes;
drop policy if exists "cliente_responder"     on public.ticket_mensajes;

create policy "cliente_sus_mensajes" on public.ticket_mensajes
  for select
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_mensajes.ticket_id
      and (
        t.cliente_id = auth.uid()
        or exists (
          select 1 from public.proyectos p
          join public.profiles pr on pr.empresa_id = p.empresa_id
          where p.id = t.proyecto_id
            and pr.id = auth.uid()
        )
      )
  ));

create policy "cliente_responder" on public.ticket_mensajes
  for insert
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_mensajes.ticket_id
      and (
        t.cliente_id = auth.uid()
        or exists (
          select 1 from public.proyectos p
          join public.profiles pr on pr.empresa_id = p.empresa_id
          where p.id = t.proyecto_id
            and pr.id = auth.uid()
        )
      )
  ));
