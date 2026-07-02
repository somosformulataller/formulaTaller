-- ============================================================================
-- Formula Taller — Multi-tenant (multi-taller)
-- ============================================================================
-- Convierte la app de un solo taller a multi-taller: cada taller (workshop)
-- tiene sus propios usuarios, órdenes y seguimiento, aislados de los demás.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Tabla workshops (talleres)
-- ----------------------------------------------------------------------------
create table if not exists public.workshops (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text        not null,
  whatsapp    text,
  owner_id    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.workshops is 'Talleres (tenants). Cada uno tiene sus usuarios y órdenes aislados.';

drop trigger if exists trg_workshops_updated_at on public.workshops;
create trigger trg_workshops_updated_at
  before update on public.workshops
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Columna workshop_id en profiles y orders
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists workshop_id uuid references public.workshops (id) on delete cascade;

alter table public.orders
  add column if not exists workshop_id uuid references public.workshops (id) on delete cascade;

create index if not exists profiles_workshop_idx on public.profiles (workshop_id);
create index if not exists orders_workshop_idx on public.orders (workshop_id);

-- ----------------------------------------------------------------------------
-- Backfill: migrar los datos actuales a un taller "Formula Taller"
-- ----------------------------------------------------------------------------
do $$
declare
  wid uuid;
  admin_id uuid;
begin
  -- ¿Hay datos existentes que migrar? (perfiles u órdenes sin taller)
  if exists (select 1 from public.profiles where workshop_id is null)
     or exists (select 1 from public.orders where workshop_id is null) then

    select id into wid from public.workshops where name = 'Formula Taller' limit 1;
    if wid is null then
      insert into public.workshops (name) values ('Formula Taller') returning id into wid;
    end if;

    update public.profiles set workshop_id = wid where workshop_id is null;
    update public.orders   set workshop_id = wid where workshop_id is null;

    select id into admin_id from public.profiles
      where role = 'admin' and workshop_id = wid
      order by created_at limit 1;
    update public.workshops set owner_id = admin_id where id = wid and owner_id is null;
  end if;
end $$;

-- Una vez migrado, workshop_id es obligatorio.
alter table public.profiles alter column workshop_id set not null;
alter table public.orders   alter column workshop_id set not null;

-- ----------------------------------------------------------------------------
-- Helper: taller del usuario actual (security definer, evita recursión en RLS)
-- ----------------------------------------------------------------------------
create or replace function public.current_workshop_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select workshop_id from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Trigger handle_new_user: copiar workshop_id desde la metadata del usuario
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, workshop_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'mechanic'),
    (new.raw_user_meta_data->>'workshop_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS por taller (defensa en profundidad; la app también filtra explícito)
-- ----------------------------------------------------------------------------
alter table public.workshops enable row level security;

-- workshops: staff puede leer solo su taller; el dueño (admin) puede actualizarlo.
drop policy if exists "staff can read own workshop" on public.workshops;
create policy "staff can read own workshop"
  on public.workshops for select
  using (id = public.current_workshop_id());

drop policy if exists "admin can update own workshop" on public.workshops;
create policy "admin can update own workshop"
  on public.workshops for update
  using (public.is_admin() and id = public.current_workshop_id());

-- profiles: restringir lecturas/escrituras al mismo taller.
drop policy if exists "staff can read profiles" on public.profiles;
create policy "staff can read profiles"
  on public.profiles for select
  using (public.is_staff() and workshop_id = public.current_workshop_id());

drop policy if exists "admin can update any profile" on public.profiles;
create policy "admin can update any profile"
  on public.profiles for update
  using (public.is_admin() and workshop_id = public.current_workshop_id());

drop policy if exists "admin can delete profiles" on public.profiles;
create policy "admin can delete profiles"
  on public.profiles for delete
  using (public.is_admin() and workshop_id = public.current_workshop_id());

-- orders: restringir al mismo taller (se mantiene la lectura pública por token).
drop policy if exists "staff can read orders" on public.orders;
create policy "staff can read orders"
  on public.orders for select
  using (public.is_staff() and workshop_id = public.current_workshop_id());

drop policy if exists "admin can update any order" on public.orders;
create policy "admin can update any order"
  on public.orders for update
  using (public.is_admin() and workshop_id = public.current_workshop_id());

drop policy if exists "mechanic can update assigned order" on public.orders;
create policy "mechanic can update assigned order"
  on public.orders for update
  using (
    public.is_staff()
    and workshop_id = public.current_workshop_id()
    and assigned_mechanic_id = auth.uid()
  );

drop policy if exists "admin can delete orders" on public.orders;
create policy "admin can delete orders"
  on public.orders for delete
  using (public.is_admin() and workshop_id = public.current_workshop_id());
