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
