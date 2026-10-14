-- ============================================================================
-- 0026 — Validación automática de las compras de saldo (banco + OCR)
-- ============================================================================
-- Igual que en La Mejor Llave, pero adaptado al saldo prepagado:
--  * El OCR lee la referencia y el monto de la captura.
--  * La conciliación busca el pago en el estado de cuenta del BDV (la misma
--    cuenta que usa La Mejor Llave, a través de la misma Bank API) y, si cuadra,
--    lo marca como usado en el banco y acredita el saldo.
--  * Se acredita lo que el banco dice que se pagó (convertido a la tasa con la
--    que se compró), no lo que se eligió: pagar de más o de menos no traba nada.
--  * El sistema NUNCA rechaza solo.
--
-- Compatible con el código anterior: se puede correr antes del push.
-- ============================================================================

-- 1. Columnas nuevas de la compra --------------------------------------------
alter table public.balance_purchases
  add column if not exists ocr_reference   text,
  add column if not exists ocr_amount      numeric(14,2),
  add column if not exists ocr_bank        text,
  add column if not exists ocr_raw         jsonb,
  add column if not exists ocr_at          timestamptz,
  -- Por qué la tiene que mirar una persona (null = la valida el sistema):
  -- referencia_repetida | sin_lectura | monto_alto | monto_distinto |
  -- pago_usado | no_aparece | ambiguo | sin_tasa | fuera_de_ventana | reclamo
  add column if not exists revision        text,
  -- Explicación interna para quien revisa (no la ve el taller).
  add column if not exists bank_note       text,
  -- El movimiento del banco que pagó esta compra.
  add column if not exists bank_tx_id      bigint,
  add column if not exists bank_response   jsonb,
  -- Lo que de verdad se sumó al saldo (puede diferir de amount_usd).
  add column if not exists credited_usd    numeric(10,2),
  -- auto | manual
  add column if not exists approved_origin text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists check_count     integer not null default 0;

-- Un movimiento del banco paga UNA sola compra, pase lo que pase.
create unique index if not exists balance_purchases_bank_tx_unico
  on public.balance_purchases (bank_tx_id)
  where bank_tx_id is not null and status = 'aprobado';

-- 2. Diario de pasadas de la conciliación (semáforo del superadmin) ----------
create table if not exists public.pagos_pasadas (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  origen      text,          -- cron | taller | superadmin
  ok          boolean not null default true,
  motivo      text,
  latido      text,          -- scrapeada | encontrada | enfriamiento | error | no_hizo_falta | lo_hizo_la_llave
  cola_al_dia timestamptz,   -- scrapeo más reciente del estado de cuenta
  pendientes  integer,
  aprobadas   integer,
  ms          integer
);
create index if not exists pagos_pasadas_fecha_idx on public.pagos_pasadas (created_at desc);
alter table public.pagos_pasadas enable row level security;

-- 3. Turno para entrar al banco ---------------------------------------------
-- La cuenta la comparten Formula Taller y La Mejor Llave, y el banco solo
-- aguanta una entrada cada ~minuto. Este cerrojo evita que dos pasadas de
-- Formula Taller entren a la vez (la de La Mejor Llave se respeta mirando lo
-- fresco que está el estado de cuenta, en el código).
create table if not exists public.banco_turno (
  id           int primary key default 1 check (id = 1),
  ultimo_latido timestamptz not null default 'epoch'
);
insert into public.banco_turno (id) values (1) on conflict do nothing;
alter table public.banco_turno enable row level security;

-- true = te toca entrar al banco (y queda apuntado); false = alguien entró hace poco.
create or replace function public.tomar_turno_banco(p_segundos int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.banco_turno
     set ultimo_latido = now()
   where id = 1
     and ultimo_latido < now() - make_interval(secs => p_segundos);
  return found;
end;
$$;

-- 4. Aprobar: ahora con monto acreditado, origen y movimiento del banco -------
-- Se borra la versión de dos argumentos para que no haya dos funciones con el
-- mismo nombre (PostgREST no sabría cuál llamar). La nueva acepta la misma
-- llamada vieja (p_purchase, p_admin) gracias a los valores por defecto.
drop function if exists public.aprobar_recarga(uuid, uuid);

create or replace function public.aprobar_recarga(
  p_purchase uuid,
  p_admin    uuid,
  p_monto    numeric default null,   -- null = lo que eligió el taller
  p_origen   text    default 'manual',
  p_bank     jsonb   default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.balance_purchases;
  v_saldo numeric;
  v_monto numeric;
  v_tx    bigint;
begin
  select * into c from public.balance_purchases where id = p_purchase for update;
  if not found then raise exception 'COMPRA_NO_EXISTE'; end if;

  if c.status = 'aprobado' then
    select balance_usd into v_saldo from public.workshops where id = c.workshop_id;
    return v_saldo;
  end if;

  v_monto := round(coalesce(p_monto, c.amount_usd), 2);
  if v_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  v_tx := case when p_bank ? 'id' then (p_bank->>'id')::bigint else c.bank_tx_id end;

  update public.balance_purchases
     set status = 'aprobado',
         reviewed_by = p_admin,
         reviewed_at = now(),
         credited_usd = v_monto,
         approved_origin = coalesce(p_origen, 'manual'),
         bank_tx_id = v_tx,
         bank_response = coalesce(p_bank, c.bank_response),
         revision = null
   where id = p_purchase;

  v_saldo := public.mover_saldo(
    c.workshop_id, v_monto, 'recarga', 'Pago Móvil ref. ' || c.reference, c.id, null, p_admin
  );

  insert into public.notifications (workshop_id, kind, message)
  values (c.workshop_id, 'saldo',
          'Recarga aprobada: se sumaron $' || to_char(v_monto, 'FM999990.00') || ' a tu saldo.');

  return v_saldo;
end;
$$;

-- 5. Rechazar: si ya estaba aprobada, retira lo que de verdad se acreditó -----
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
      c.workshop_id, -coalesce(c.credited_usd, c.amount_usd), 'reverso',
      'Recarga anulada: ' || coalesce(p_note, ''), c.id, null, p_admin
    );
  end if;

  update public.balance_purchases
     set status = 'rechazado', note = p_note, reviewed_by = p_admin, reviewed_at = now(),
         bank_tx_id = null
   where id = p_purchase;

  insert into public.notifications (workshop_id, kind, message)
  values (c.workshop_id, 'saldo',
          'Recarga rechazada ($' || to_char(c.amount_usd, 'FM999990.00') || '): ' || coalesce(p_note, 'sin motivo'));
end;
$$;

revoke all on function public.aprobar_recarga(uuid, uuid, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.rechazar_recarga(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.tomar_turno_banco(int) from public, anon, authenticated;
grant execute on function public.aprobar_recarga(uuid, uuid, numeric, text, jsonb) to service_role;
grant execute on function public.rechazar_recarga(uuid, text, uuid) to service_role;
grant execute on function public.tomar_turno_banco(int) to service_role;

-- Las compras ya aprobadas acreditaron lo que se eligió.
update public.balance_purchases
   set credited_usd = amount_usd, approved_origin = coalesce(approved_origin, 'manual')
 where status = 'aprobado' and credited_usd is null;

notify pgrst, 'reload schema';
