-- TABLA: profiles
-- Extiende auth.users con datos adicionales del usuario y su rol en la plataforma

create table public.profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  nombre    text not null,
  email     text not null,
  rol       text not null check (rol in ('admin', 'cliente')),
  empresa   text,
  telefono  text,
  activo    boolean default true,
  created_at timestamptz default now()
);

-- Trigger para crear perfil automáticamente al registrar usuario en auth.users
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
