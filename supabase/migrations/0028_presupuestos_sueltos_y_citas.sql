-- ============================================================================
-- Formula Taller — Presupuestos sueltos y citas (0028)
-- ============================================================================
--  1. quotes: presupuesto que se le envía al cliente ANTES de crear la orden.
--     Sus ítems van en `items` (jsonb). Al vincularlo a una orden se copian a
--     order_budget_items y queda `order_id` puesto.
--  2. appointments: citas con clientes y horarios ocupados del taller, para el
--     calendario. Sin duración: solo día y, si se quiere, hora.
--  3. Saldo: crear un presupuesto suelto cobra price_quote_usd ($0,15).
--
-- Se lee y escribe desde las API con la clave de servicio, que comprueban el
-- taller de quien llama. RLS activado con lectura solo para el administrador.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 1. Presupuestos sueltos
-- ============================================================================
create table if not exists public.quotes (
  id                 uuid primary key default extensions.gen_random_uuid(),
  workshop_id        uuid not null references public.workshops (id) on delete cascade,
  client_id          uuid references public.clients (id) on delete set null,
  client_first_name  text not null default '',
  client_last_name   text not null default '',
  client_whatsapp    text not null,
  car_model          text not null default '',
  -- [{ description, amount, labor_amount }]
  items              jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  labor_general_usd  numeric(12,2) not null default 0 check (labor_general_usd >= 0),
  -- Orden a la que se vinculó (null = todavía suelto).
  order_id           uuid references public.orders (id) on delete set null,
  linked_at          timestamptz,
  sent_at            timestamptz,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists quotes_workshop_idx on public.quotes (workshop_id, created_at desc);
create index if not exists quotes_client_idx on public.quotes (client_id);
create index if not exists quotes_order_idx on public.quotes (order_id);

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

alter table public.quotes enable row level security;
drop policy if exists "admin can read quotes" on public.quotes;
create policy "admin can read quotes"
  on public.quotes for select
  using (public.is_admin() and workshop_id = public.current_workshop_id());

-- ============================================================================
-- 2. Citas y horarios ocupados
-- ============================================================================
create table if not exists public.appointments (
  id          uuid primary key default extensions.gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  -- cita = un cliente viene; ocupado = el taller no atiende ese día u hora.
  kind        text not null default 'cita' check (kind in ('cita', 'ocupado')),
  client_id   uuid references public.clients (id) on delete cascade,
  quote_id    uuid references public.quotes (id) on delete set null,
  order_id    uuid references public.orders (id) on delete set null,
  day         date not null,
  -- null = sin hora (cita) o todo el día (ocupado).
  at_time     time,
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  constraint appointments_cita_con_cliente check (kind = 'ocupado' or client_id is not null)
);
create index if not exists appointments_workshop_day_idx on public.appointments (workshop_id, day);
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists appointments_quote_idx on public.appointments (quote_id);

alter table public.appointments enable row level security;
drop policy if exists "admin can read appointments" on public.appointments;
create policy "admin can read appointments"
  on public.appointments for select
  using (public.is_admin() and workshop_id = public.current_workshop_id());

-- ============================================================================
-- 3. Cobro del presupuesto suelto
-- ============================================================================
alter table public.platform_settings
  add column if not exists price_quote_usd numeric(10,4) not null default 0.15;

alter table public.balance_movements drop constraint if exists balance_movements_kind_valid;
alter table public.balance_movements add constraint balance_movements_kind_valid
  check (kind in ('bienvenida', 'recarga', 'orden', 'presupuesto', 'pregunta_ia', 'ajuste', 'reverso'));
