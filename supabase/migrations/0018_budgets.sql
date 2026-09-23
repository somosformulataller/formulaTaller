-- ============================================================================
-- Formula Taller — Presupuesto por orden
-- ============================================================================
-- Una lista de repuestos y servicios con su precio en dólares, colgada de la
-- orden. El total NO se guarda: se suma siempre desde los ítems, así nunca
-- puede quedar desfasado del detalle.
--
-- Igual que order_stages, esta tabla NO lleva workshop_id: se aísla por el
-- taller de la ORDEN padre con order_in_my_workshop() (ver 0014). Es la misma
-- fuente de verdad que ya usan etapas y adjuntos, no falsificable por el
-- cliente y sin backfill.
--
-- Quién escribe: admin y mecánico del taller de la orden, igual que el resto
-- de la orden (canManageOrder). El cliente lo VE en su enlace de seguimiento,
-- que se sirve desde el servidor con el service client — por eso aquí no hay
-- ninguna política para `anon` (0013 cerró la lectura anónima a propósito).
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

create table if not exists public.order_budget_items (
  id          uuid primary key default extensions.gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  -- Lo que se cobra: "Pastillas de freno delanteras", "Mano de obra"...
  description text not null,
  -- Dólares. numeric, NUNCA float: con float 0.1 + 0.2 no da 0.3 y los
  -- totales de dinero terminan con centavos fantasma.
  amount      numeric(12,2) not null default 0,
  -- Orden en que se muestran; se va incrementando al agregar.
  position    integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint order_budget_items_amount_positive check (amount >= 0),
  constraint order_budget_items_description_not_blank check (btrim(description) <> '')
);

comment on table public.order_budget_items is
  'Ítems del presupuesto de una orden (repuestos y servicios). El total se suma, no se guarda.';

create index if not exists order_budget_items_order_idx
  on public.order_budget_items (order_id, position);

drop trigger if exists trg_order_budget_items_updated_at on public.order_budget_items;
create trigger trg_order_budget_items_updated_at
  before update on public.order_budget_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — aislamiento por el taller de la orden padre
-- ----------------------------------------------------------------------------
alter table public.order_budget_items enable row level security;

drop policy if exists "staff can read budget items" on public.order_budget_items;
create policy "staff can read budget items"
  on public.order_budget_items for select
  using (public.is_staff() and public.order_in_my_workshop(order_id));

drop policy if exists "staff can insert budget items" on public.order_budget_items;
create policy "staff can insert budget items"
  on public.order_budget_items for insert
  with check (public.is_staff() and public.order_in_my_workshop(order_id));

drop policy if exists "staff can update budget items" on public.order_budget_items;
create policy "staff can update budget items"
  on public.order_budget_items for update
  using (public.is_staff() and public.order_in_my_workshop(order_id))
  with check (public.is_staff() and public.order_in_my_workshop(order_id));

drop policy if exists "staff can delete budget items" on public.order_budget_items;
create policy "staff can delete budget items"
  on public.order_budget_items for delete
  using (public.is_staff() and public.order_in_my_workshop(order_id));
