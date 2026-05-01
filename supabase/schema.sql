-- ============================================================
-- MEETUP PLATFORM — SCHEMA COMPLETO
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- PERFILES DE USUARIO
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  nombre     text not null,
  email      text not null,
  rol        text not null check (rol in ('admin', 'cliente')),
  empresa    text,
  telefono   text,
  activo     boolean default true,
  created_at timestamptz default now()
);

-- Trigger: crear perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'cliente')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- PROYECTOS
create table if not exists public.proyectos (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  descripcion        text,
  cliente_id         uuid references public.profiles(id),
  estado             text default 'activo' check (estado in ('activo','pausado','completado','cancelado')),
  fecha_inicio       date,
  fecha_estimada_fin date,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ETAPAS
create table if not exists public.etapas (
  id                          uuid primary key default gen_random_uuid(),
  proyecto_id                 uuid references public.proyectos(id) on delete cascade,
  nombre                      text not null,
  descripcion                 text,
  orden                       integer not null,
  estado                      text default 'pendiente' check (estado in ('pendiente','en_progreso','completado','aprobado')),
  requiere_aprobacion_cliente boolean default false,
  fecha_inicio                date,
  fecha_fin                   date,
  notas                       text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

-- EVIDENCIAS
create table if not exists public.evidencias (
  id         uuid primary key default gen_random_uuid(),
  etapa_id   uuid references public.etapas(id) on delete cascade,
  nombre     text not null,
  url        text not null,
  tipo       text,
  subido_por uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- TICKETS DE SOPORTE
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  consecutivo text unique not null default '',
  proyecto_id uuid references public.proyectos(id),
  cliente_id  uuid references public.profiles(id),
  titulo      text not null,
  descripcion text not null,
  ubicacion   text,
  prioridad   text default 'media' check (prioridad in ('baja','media','alta','critica')),
  estado      text default 'abierto' check (estado in ('abierto','en_revision','en_campo','resuelto','cerrado')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- MENSAJES DE TICKET
create table if not exists public.ticket_mensajes (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid references public.tickets(id) on delete cascade,
  autor_id   uuid references public.profiles(id),
  mensaje    text not null,
  leido      boolean default false,
  created_at timestamptz default now()
);

-- FUNCIÓN: consecutivo automático TK-YYYY-XXXX
create or replace function generar_consecutivo()
returns trigger as $$
declare
  anio     text;
  contador integer;
begin
  anio := to_char(now(), 'YYYY');
  select count(*) + 1 into contador
  from public.tickets
  where consecutivo like 'TK-' || anio || '-%';
  new.consecutivo := 'TK-' || anio || '-' || lpad(contador::text, 4, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_consecutivo on public.tickets;
create trigger trigger_consecutivo
  before insert on public.tickets
  for each row execute function generar_consecutivo();

-- ROW LEVEL SECURITY
alter table public.profiles        enable row level security;
alter table public.proyectos       enable row level security;
alter table public.etapas          enable row level security;
alter table public.evidencias      enable row level security;
alter table public.tickets         enable row level security;
alter table public.ticket_mensajes enable row level security;

-- POLÍTICAS ADMIN
create policy "admin_all_profiles"   on public.profiles        for all using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));
create policy "admin_all_proyectos"  on public.proyectos       for all using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));
create policy "admin_all_etapas"     on public.etapas          for all using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));
create policy "admin_all_evidencias" on public.evidencias      for all using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));
create policy "admin_all_tickets"    on public.tickets         for all using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));
create policy "admin_all_mensajes"   on public.ticket_mensajes for all using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

-- POLÍTICAS CLIENTE
create policy "cliente_own_profile"    on public.profiles for select using (id = auth.uid());
create policy "cliente_update_profile" on public.profiles for update using (id = auth.uid());
create policy "cliente_sus_proyectos"  on public.proyectos  for select using (cliente_id = auth.uid());
create policy "cliente_sus_etapas"     on public.etapas     for select using (exists (select 1 from public.proyectos where id = etapas.proyecto_id and cliente_id = auth.uid()));
create policy "cliente_sus_evidencias" on public.evidencias for select using (exists (select 1 from public.etapas e join public.proyectos p on e.proyecto_id = p.id where e.id = evidencias.etapa_id and p.cliente_id = auth.uid()));
create policy "cliente_sus_tickets"    on public.tickets    for select using (cliente_id = auth.uid());
create policy "cliente_crear_ticket"   on public.tickets    for insert with check (cliente_id = auth.uid());
create policy "cliente_sus_mensajes"   on public.ticket_mensajes for select using (exists (select 1 from public.tickets where id = ticket_mensajes.ticket_id and cliente_id = auth.uid()));
create policy "cliente_responder"      on public.ticket_mensajes for insert with check (exists (select 1 from public.tickets where id = ticket_mensajes.ticket_id and cliente_id = auth.uid()));
