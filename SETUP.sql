-- ============================================================
-- Formula Taller — SETUP COMPLETO (pegar en Supabase SQL Editor)
-- Ejecuta TODO este archivo de una vez (boton RUN).
-- ============================================================

-- ============================================================================
-- Formula Taller — initial schema
-- ============================================================================
-- Enums, tables, triggers and helper functions.
-- RLS policies live in 0002_rls.sql.
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'mechanic');
exception when duplicate_object then null; end $$;

do $$ begin
  -- sin_mecanico : order without an assigned mechanic
  -- con_mecanico : order with an assigned mechanic (in progress)
  -- lista        : vehicle ready to be delivered
  create type public.order_status as enum ('sin_mecanico', 'con_mecanico', 'lista');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stage_status as enum ('pending', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- profiles — one row per auth user, holds the role
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null,
  role        public.user_role not null default 'mechanic',
  phone       text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Application users (admins and mechanics).';

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id                    uuid primary key default extensions.gen_random_uuid(),
  public_token          uuid not null unique default extensions.gen_random_uuid(),
  client_first_name     text not null,
  client_last_name      text not null,
  client_whatsapp       text not null,
  car_model             text not null,
  assigned_mechanic_id  uuid references public.profiles (id) on delete set null,
  status                public.order_status not null default 'sin_mecanico',
  notes                 text,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.orders is 'Workshop orders. public_token is shared with the client for tracking.';

create index if not exists orders_assigned_mechanic_idx on public.orders (assigned_mechanic_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- ----------------------------------------------------------------------------
-- order_stages — the vertical progress timeline shown to the client
-- ----------------------------------------------------------------------------
create table if not exists public.order_stages (
  id            uuid primary key default extensions.gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  name          text not null,
  position      integer not null default 0,
  status        public.stage_status not null default 'pending',
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.order_stages is 'Tracking stages for an order (mechanic-managed, client-visible).';

create index if not exists order_stages_order_idx on public.order_stages (order_id, position);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Seed the default tracking stages whenever an order is created.
-- The first two are marked done because they happen at intake.
-- ----------------------------------------------------------------------------
create or replace function public.seed_default_stages()
returns trigger
language plpgsql
as $$
begin
  insert into public.order_stages (order_id, name, position, status, completed_at) values
    (new.id, 'Vehículo recibido',      1, 'done',    now()),
    (new.id, 'Orden creada',           2, 'done',    now()),
    (new.id, 'Revisión general',       3, 'pending', null),
    (new.id, 'Se identificó la falla', 4, 'pending', null),
    (new.id, 'Cambiando repuestos',    5, 'pending', null),
    (new.id, 'Cambio de aceite',       6, 'pending', null);
  return new;
end;
$$;

drop trigger if exists trg_seed_stages on public.orders;
create trigger trg_seed_stages
  after insert on public.orders
  for each row execute function public.seed_default_stages();

-- ----------------------------------------------------------------------------
-- Role helpers (security definer to avoid recursive RLS on profiles)
-- ----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;


-- ============================================================================
-- Formula Taller — Row Level Security policies
-- ============================================================================
-- Depends on: 0001_init.sql (tables and helper functions must exist)
-- ----------------------------------------------------------------------------

-- Enable RLS on all tables
alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_stages enable row level security;

-- ============================================================================
-- profiles
-- ============================================================================

-- Staff (any active user) can read all profiles
create policy "staff can read profiles"
  on public.profiles
  for select
  using (public.is_staff());

-- Admin can insert new profiles (mechanic creation)
create policy "admin can insert profiles"
  on public.profiles
  for insert
  with check (public.is_admin());

-- Admin can update any profile; mechanic can update their own
create policy "admin can update any profile"
  on public.profiles
  for update
  using (public.is_admin());

create policy "mechanic can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id and public.is_staff());

-- Only admin can delete profiles
create policy "admin can delete profiles"
  on public.profiles
  for delete
  using (public.is_admin());

-- ============================================================================
-- orders
-- ============================================================================

-- Staff can read all orders
create policy "staff can read orders"
  on public.orders
  for select
  using (public.is_staff());

-- Staff can create orders
create policy "staff can insert orders"
  on public.orders
  for insert
  with check (public.is_staff());

-- Staff can update orders (admin: any, mechanic: only assigned)
create policy "admin can update any order"
  on public.orders
  for update
  using (public.is_admin());

create policy "mechanic can update assigned order"
  on public.orders
  for update
  using (
    public.is_staff()
    and assigned_mechanic_id = auth.uid()
  );

-- Only admin can delete orders
create policy "admin can delete orders"
  on public.orders
  for delete
  using (public.is_admin());

-- Anonymous / client access: read by public_token (for tracking page)
create policy "anon can read order by token"
  on public.orders
  for select
  using (true);   -- We filter by token in the query; token is a random UUID

-- ============================================================================
-- order_stages
-- ============================================================================

-- Staff can read all stages
create policy "staff can read stages"
  on public.order_stages
  for select
  using (public.is_staff());

-- Staff can insert stages
create policy "staff can insert stages"
  on public.order_stages
  for insert
  with check (public.is_staff());

-- Staff can update stages (admin: any, mechanic: for assigned orders only)
create policy "admin can update any stage"
  on public.order_stages
  for update
  using (public.is_admin());

create policy "mechanic can update stages of assigned order"
  on public.order_stages
  for update
  using (
    public.is_staff()
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.assigned_mechanic_id = auth.uid()
    )
  );

-- Only admin can delete stages
create policy "admin can delete stages"
  on public.order_stages
  for delete
  using (public.is_admin());

-- Anonymous / client: can read stages for any order (token is the gate)
create policy "anon can read stages"
  on public.order_stages
  for select
  using (true);

-- ============================================================================
-- Handle new user → auto-insert profile (service role creates users)
-- The API route uses service_role key, so it inserts into profiles directly.
-- This trigger handles the edge case if someone signs up via Supabase dashboard.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only insert if a profile doesn't already exist
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'mechanic')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();
