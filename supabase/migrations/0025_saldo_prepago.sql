-- ============================================================================
-- 0025 — Saldo prepagado
--
-- Reemplaza el plan gratuito de N órdenes y la suscripción: cada taller tiene
-- un saldo en dólares que se gasta al usar la app.
--   • Crear una orden y cada pregunta al asistente IA descuentan saldo (los
--     precios se editan en el superadmin, platform_settings).
--   • El taller compra saldo por Pago Móvil subiendo el comprobante. TODO
--     pago queda pendiente hasta que la plataforma lo aprueba a mano en el
--     superadmin: no hay validación automática.
--   • Cada taller recibe un saldo de bienvenida (los actuales también, una vez).
--
-- Todo movimiento de saldo pasa por mover_saldo(), que nunca deja el saldo en
-- negativo y anota el movimiento en el libro balance_movements.
--
-- Seguro de correr más de una vez (idempotente).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configuración global
-- ----------------------------------------------------------------------------
alter table public.platform_settings
  add column if not exists price_order_usd       numeric(10,4) not null default 0.20,
  add column if not exists price_ai_question_usd numeric(10,4) not null default 0.035,
  add column if not exists welcome_balance_usd   numeric(10,2) not null default 3,
  add column if not exists pago_movil_bank       text,
  add column if not exists pago_movil_phone      text,
  add column if not exists pago_movil_document   text,
  add column if not exists pago_movil_holder     text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'platform_settings_prices_valid') then
    alter table public.platform_settings add constraint platform_settings_prices_valid
      check (price_order_usd >= 0 and price_ai_question_usd >= 0 and welcome_balance_usd >= 0);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Saldo del taller
-- ----------------------------------------------------------------------------
alter table public.workshops
  add column if not exists balance_usd numeric(12,4) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workshops_balance_not_negative') then
    alter table public.workshops add constraint workshops_balance_not_negative check (balance_usd >= 0);
  end if;
end $$;

-- El saldo, como la suscripción, solo lo cambia la plataforma. El admin del
-- taller puede editar su fila (nombre, logo…) pero no esta columna. Se deja
-- pasar a postgres para que las funciones de abajo (SECURITY DEFINER) y el
-- SQL Editor puedan mover saldo.
create or replace function public.guard_workshop_privileged_cols()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres') then
    return new;
  end if;
  if new.is_subscribed is distinct from old.is_subscribed
     or new.order_limit  is distinct from old.order_limit
     or new.is_test      is distinct from old.is_test
     or new.owner_id     is distinct from old.owner_id
     or new.balance_usd  is distinct from old.balance_usd then
    raise exception 'Estos campos del taller solo los cambia la plataforma';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Libro de movimientos
-- ----------------------------------------------------------------------------
create table if not exists public.balance_movements (
  id            uuid primary key default extensions.gen_random_uuid(),
  workshop_id   uuid not null references public.workshops (id) on delete cascade,
  -- bienvenida | recarga | orden | pregunta_ia | ajuste | reverso
  kind          text not null,
  -- Con signo: positivo suma, negativo descuenta.
  amount_usd    numeric(12,4) not null,
  balance_after numeric(12,4) not null,
  purchase_id   uuid,
  order_id      uuid references public.orders (id) on delete set null,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'balance_movements_kind_valid') then
    alter table public.balance_movements add constraint balance_movements_kind_valid
      check (kind in ('bienvenida', 'recarga', 'orden', 'pregunta_ia', 'ajuste', 'reverso'));
  end if;
end $$;
create index if not exists balance_movements_workshop_idx
  on public.balance_movements (workshop_id, created_at desc);

alter table public.balance_movements enable row level security;
drop policy if exists "admin can read balance movements" on public.balance_movements;
create policy "admin can read balance movements"
  on public.balance_movements for select
  using (public.is_admin() and workshop_id = public.current_workshop_id());

-- ----------------------------------------------------------------------------
-- 4. Compras de saldo (Pago Móvil, revisión manual)
-- ----------------------------------------------------------------------------
create table if not exists public.balance_purchases (
  id             uuid primary key default extensions.gen_random_uuid(),
  workshop_id    uuid not null references public.workshops (id) on delete cascade,
  amount_usd     numeric(10,2) not null,
  amount_ves     numeric(14,2),
  exchange_rate  numeric(14,4),
  reference      text not null,
  -- Los últimos 6 dígitos: con eso se detecta una referencia repetida.
  reference_tail text generated always as (right(regexp_replace(reference, '\D', '', 'g'), 6)) stored,
  -- Ruta del comprobante en el bucket privado stage-files (pagos/<taller>/…).
  proof_path     text not null,
  -- pendiente | aprobado | rechazado
  status         text not null default 'pendiente',
  -- Motivo del rechazo, o el aviso de referencia repetida.
  note           text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  reviewed_by    uuid,
  reviewed_at    timestamptz
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'balance_purchases_status_valid') then
    alter table public.balance_purchases add constraint balance_purchases_status_valid
      check (status in ('pendiente', 'aprobado', 'rechazado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'balance_purchases_amount_positive') then
    alter table public.balance_purchases add constraint balance_purchases_amount_positive
      check (amount_usd > 0);
  end if;
end $$;
create index if not exists balance_purchases_status_idx
  on public.balance_purchases (status, created_at desc);
create index if not exists balance_purchases_workshop_idx
  on public.balance_purchases (workshop_id, created_at desc);
create index if not exists balance_purchases_tail_idx
  on public.balance_purchases (reference_tail);
-- Una compra en revisión a la vez por taller.
create unique index if not exists balance_purchases_one_pending
  on public.balance_purchases (workshop_id) where status = 'pendiente';

alter table public.balance_purchases enable row level security;
drop policy if exists "admin can read balance purchases" on public.balance_purchases;
create policy "admin can read balance purchases"
  on public.balance_purchases for select
  using (public.is_admin() and workshop_id = public.current_workshop_id());

-- ----------------------------------------------------------------------------
-- 5. Funciones (solo la app, con la clave de servicio)
-- ----------------------------------------------------------------------------

-- Suma (monto > 0) o descuenta (monto < 0) saldo y lo anota. Si el saldo no
-- alcanza, falla con SALDO_INSUFICIENTE y no cambia nada. Devuelve el saldo nuevo.
create or replace function public.mover_saldo(
  p_workshop uuid,
  p_monto    numeric,
  p_kind     text,
  p_note     text default null,
  p_purchase uuid default null,
  p_order    uuid default null,
  p_user     uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
begin
  update public.workshops
     set balance_usd = balance_usd + p_monto
   where id = p_workshop
     and balance_usd + p_monto >= 0
  returning balance_usd into v_saldo;

  if not found then
    if not exists (select 1 from public.workshops where id = p_workshop) then
      raise exception 'TALLER_NO_EXISTE';
    end if;
    raise exception 'SALDO_INSUFICIENTE';
  end if;

  insert into public.balance_movements
    (workshop_id, kind, amount_usd, balance_after, purchase_id, order_id, note, created_by)
  values
    (p_workshop, p_kind, p_monto, v_saldo, p_purchase, p_order, p_note, p_user);

  return v_saldo;
end;
$$;

-- Aprueba una compra y acredita el saldo. Si ya estaba aprobada no vuelve a
-- sumar (dos clics o dos pestañas no acreditan dos veces).
create or replace function public.aprobar_recarga(p_purchase uuid, p_admin uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.balance_purchases;
  v_saldo numeric;
begin
  select * into c from public.balance_purchases where id = p_purchase for update;
  if not found then raise exception 'COMPRA_NO_EXISTE'; end if;

  if c.status = 'aprobado' then
    select balance_usd into v_saldo from public.workshops where id = c.workshop_id;
    return v_saldo;
  end if;

  update public.balance_purchases
     set status = 'aprobado', reviewed_by = p_admin, reviewed_at = now()
   where id = p_purchase;

  v_saldo := public.mover_saldo(
    c.workshop_id, c.amount_usd, 'recarga', 'Pago Móvil ref. ' || c.reference, c.id, null, p_admin
  );

  insert into public.notifications (workshop_id, kind, message)
  values (c.workshop_id, 'saldo',
          'Recarga aprobada: se sumaron $' || to_char(c.amount_usd, 'FM999990.00') || ' a tu saldo.');

  return v_saldo;
end;
$$;

-- Rechaza una compra con su motivo. Si ya estaba aprobada, retira el saldo
-- que se había acreditado (falla si el taller ya lo gastó).
create or replace function public.rechazar_recarga(p_purchase uuid, p_note text, p_admin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.balance_purchases;
begin
  select * into c from public.balance_purchases where id = p_purchase for update;
  if not found then raise exception 'COMPRA_NO_EXISTE'; end if;
  if c.status = 'rechazado' then return; end if;

  if c.status = 'aprobado' then
    perform public.mover_saldo(
      c.workshop_id, -c.amount_usd, 'reverso', 'Recarga anulada: ' || coalesce(p_note, ''), c.id, null, p_admin
    );
  end if;

  update public.balance_purchases
     set status = 'rechazado', note = p_note, reviewed_by = p_admin, reviewed_at = now()
   where id = p_purchase;

  insert into public.notifications (workshop_id, kind, message)
  values (c.workshop_id, 'saldo',
          'Recarga rechazada ($' || to_char(c.amount_usd, 'FM999990.00') || '): ' || coalesce(p_note, 'sin motivo'));
end;
$$;

revoke all on function public.mover_saldo(uuid, numeric, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.aprobar_recarga(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rechazar_recarga(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.mover_saldo(uuid, numeric, text, text, uuid, uuid, uuid) to service_role;
grant execute on function public.aprobar_recarga(uuid, uuid) to service_role;
grant execute on function public.rechazar_recarga(uuid, text, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 6. Saldo de bienvenida
-- ----------------------------------------------------------------------------
-- Talleres nuevos: el saldo inicial lo pone la base, no quien registra.
create or replace function public.workshop_saldo_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    new.balance_usd := coalesce((select welcome_balance_usd from public.platform_settings where id = 1), 0);
    return new;
  end if;
  if new.balance_usd > 0 then
    insert into public.balance_movements (workshop_id, kind, amount_usd, balance_after, note)
    values (new.id, 'bienvenida', new.balance_usd, new.balance_usd, 'Saldo de bienvenida');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_workshop_saldo_bienvenida_before on public.workshops;
create trigger trg_workshop_saldo_bienvenida_before
  before insert on public.workshops
  for each row execute function public.workshop_saldo_bienvenida();

drop trigger if exists trg_workshop_saldo_bienvenida_after on public.workshops;
create trigger trg_workshop_saldo_bienvenida_after
  after insert on public.workshops
  for each row execute function public.workshop_saldo_bienvenida();

-- Talleres que ya existían: reciben el saldo de bienvenida una sola vez.
do $$
declare
  w record;
  v_bienvenida numeric := coalesce((select welcome_balance_usd from public.platform_settings where id = 1), 0);
begin
  if v_bienvenida <= 0 then return; end if;
  for w in
    select id from public.workshops ws
     where not exists (
       select 1 from public.balance_movements m where m.workshop_id = ws.id and m.kind = 'bienvenida'
     )
  loop
    perform public.mover_saldo(w.id, v_bienvenida, 'bienvenida', 'Saldo de bienvenida');
  end loop;
end $$;
