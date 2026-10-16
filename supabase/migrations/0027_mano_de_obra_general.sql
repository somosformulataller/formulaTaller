-- ============================================================================
-- 0027 — Mano de obra general del presupuesto
-- ============================================================================
-- Además de la mano de obra de cada ítem (opcional desde ahora), la orden
-- puede llevar UNA mano de obra general por todos los servicios. Se suma al
-- total del presupuesto; el cliente no la aprueba ni la rechaza aparte.
--
-- Compatible con el código anterior: se puede correr antes del push.
-- Seguro de correr más de una vez (idempotente).
-- ============================================================================

alter table public.orders
  add column if not exists labor_general_usd numeric(12,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_labor_general_positive') then
    alter table public.orders
      add constraint orders_labor_general_positive check (labor_general_usd >= 0);
  end if;
end $$;

comment on column public.orders.labor_general_usd is
  'Mano de obra general del presupuesto, por todos los servicios (USD).';
