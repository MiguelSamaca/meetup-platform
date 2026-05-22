-- ============================================================
-- MIGRACIÓN 003 — TENANTS (SaaS Multi-tenant)
-- Cada "tenant" es una empresa integradora que compra la plataforma
-- ============================================================

-- 1. TABLA TENANTS (empresas integradoras / compradores de la plataforma)
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text unique,
  plan       text default 'basico' check (plan in ('basico', 'profesional', 'enterprise')),
  activo     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Actualizar rol en profiles para incluir 'superadmin'
alter table public.profiles
  drop constraint if exists profiles_rol_check;

alter table public.profiles
  add constraint profiles_rol_check
  check (rol in ('superadmin', 'admin', 'cliente'));

-- 3. tenant_id en profiles (null = superadmin, no pertenece a ningún tenant)
alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- 4. tenant_id en empresas (cada empresa-cliente pertenece a un tenant)
alter table public.empresas
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- 5. tenant_id en proyectos
alter table public.proyectos
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- 6. tenant_id en tickets
alter table public.tickets
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- ============================================================
-- RLS — TENANTS
-- ============================================================
alter table public.tenants enable row level security;

create policy "superadmin_all_tenants" on public.tenants
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

create policy "admin_ver_su_tenant" on public.tenants
  for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and tenant_id = tenants.id
  ));

-- ============================================================
-- RLS — PROFILES: reemplazar políticas admin para ser tenant-aware
-- ============================================================
drop policy if exists "admin_all_profiles" on public.profiles;

-- Superadmin ve todo
create policy "superadmin_all_profiles" on public.profiles
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

-- Admin solo ve profiles de su mismo tenant
create policy "admin_tenant_profiles" on public.profiles
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.rol = 'admin'
      and p.tenant_id = profiles.tenant_id
  ));

-- ============================================================
-- RLS — PROYECTOS: tenant-aware
-- ============================================================
drop policy if exists "admin_all_proyectos" on public.proyectos;

create policy "superadmin_all_proyectos" on public.proyectos
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

create policy "admin_tenant_proyectos" on public.proyectos
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.rol = 'admin'
      and p.tenant_id = proyectos.tenant_id
  ));

-- ============================================================
-- RLS — ETAPAS: tenant-aware (via proyecto)
-- ============================================================
drop policy if exists "admin_all_etapas" on public.etapas;

create policy "superadmin_all_etapas" on public.etapas
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

create policy "admin_tenant_etapas" on public.etapas
  for all
  using (exists (
    select 1 from public.proyectos p
    join public.profiles pr on pr.tenant_id = p.tenant_id
    where p.id = etapas.proyecto_id
      and pr.id = auth.uid()
      and pr.rol = 'admin'
  ));

-- ============================================================
-- RLS — EVIDENCIAS: tenant-aware (via etapa → proyecto)
-- ============================================================
drop policy if exists "admin_all_evidencias" on public.evidencias;

create policy "superadmin_all_evidencias" on public.evidencias
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

create policy "admin_tenant_evidencias" on public.evidencias
  for all
  using (exists (
    select 1 from public.etapas e
    join public.proyectos p  on p.id = e.proyecto_id
    join public.profiles pr  on pr.tenant_id = p.tenant_id
    where e.id = evidencias.etapa_id
      and pr.id = auth.uid()
      and pr.rol = 'admin'
  ));

-- ============================================================
-- RLS — TICKETS: tenant-aware
-- ============================================================
drop policy if exists "admin_all_tickets" on public.tickets;

create policy "superadmin_all_tickets" on public.tickets
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

create policy "admin_tenant_tickets" on public.tickets
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.rol = 'admin'
      and p.tenant_id = tickets.tenant_id
  ));

-- ============================================================
-- RLS — TICKET_MENSAJES: tenant-aware (via ticket)
-- ============================================================
drop policy if exists "admin_all_mensajes" on public.ticket_mensajes;

create policy "superadmin_all_mensajes" on public.ticket_mensajes
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

create policy "admin_tenant_mensajes" on public.ticket_mensajes
  for all
  using (exists (
    select 1 from public.tickets t
    join public.profiles p on p.tenant_id = t.tenant_id
    where t.id = ticket_mensajes.ticket_id
      and p.id = auth.uid()
      and p.rol = 'admin'
  ));

-- ============================================================
-- RLS — EMPRESAS: tenant-aware
-- ============================================================
drop policy if exists "admin_all_empresas" on public.empresas;

create policy "superadmin_all_empresas" on public.empresas
  for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'superadmin'
  ));

create policy "admin_tenant_empresas" on public.empresas
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.rol = 'admin'
      and p.tenant_id = empresas.tenant_id
  ));
