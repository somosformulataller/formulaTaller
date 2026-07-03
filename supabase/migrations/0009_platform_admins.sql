-- ============================================================================
-- Formula Taller — Superadmins de plataforma + suscripción de talleres
-- ============================================================================
-- Agrega un rol por encima de los talleres (superadmin de toda la app) y un
-- interruptor de suscripción por taller que, cuando está activo, da órdenes
-- ilimitadas (ignora order_limit del plan gratuito).
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Tabla platform_admins: administradores de toda la plataforma.
-- No pertenecen a ningún taller (no tienen fila en profiles).
-- ----------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Administradores de toda la plataforma (por encima de los talleres). Acceso solo vía service_role.';

-- RLS habilitado y SIN políticas: queda bloqueada para todos salvo el
-- service_role (que la usa la app en el servidor). Defensa en profundidad.
alter table public.platform_admins enable row level security;

-- ----------------------------------------------------------------------------
-- Suscripción del taller: si es true → órdenes ilimitadas (ignora order_limit).
-- ----------------------------------------------------------------------------
alter table public.workshops
  add column if not exists is_subscribed boolean not null default false;

-- ----------------------------------------------------------------------------
-- handle_new_user: los superadmins se crean sin workshop_id. En ese caso NO se
-- debe crear perfil (profiles.workshop_id es NOT NULL y la inserción fallaría,
-- lo que abortaría la creación del usuario). Se salta cuando no hay taller.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid := (new.raw_user_meta_data->>'workshop_id')::uuid;
begin
  if wid is null then
    -- Usuario sin taller (p. ej. superadmin de plataforma): no crear perfil.
    return new;
  end if;

  insert into public.profiles (id, full_name, role, workshop_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'mechanic'),
    wid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
