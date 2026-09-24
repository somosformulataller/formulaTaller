-- ============================================================================
-- 0021 — Una orden puede tener VARIOS mecánicos
--
-- CÓMO ERA
-- La orden tenía una sola columna, `assigned_mechanic_id`: un carro, un
-- mecánico. En un taller real un carro lo tocan dos o tres personas (el de
-- latonería, el de electricidad, el que hace la prueba de ruta).
--
-- CÓMO QUEDA
--   · Nace `order_mechanics`: la lista de mecánicos de cada orden.
--   · Todos son IGUALES. No hay principal ni ayudante: si estás en la lista,
--     la orden es tuya, la ves y la trabajas.
--   · Sigue asignando SOLO el administrador (0019). El mecánico no se agrega
--     ni se quita a sí mismo, ni agrega a un compañero.
--   · El cliente, en su seguimiento, ve los nombres de TODOS los asignados
--     (salvo que la orden se muestre «como el taller», migración 0020).
--
-- QUÉ PASA CON `orders.assigned_mechanic_id`
-- No se borra: pasa a ser un ESPEJO que la base mantiene sola (el primero de
-- la lista, o NULL si no hay nadie). Sirve para que lo viejo que todavía la
-- lee —el panel del superadmin, informes— no se rompa. Nadie debe escribirla
-- a mano: la verdad está en `order_mechanics`.
--
-- Igual que la 0019, esto se cierra en DOS capas: aquí y en la API
-- (src/lib/api-auth.ts), porque la API escribe con la clave de servicio y se
-- salta RLS, y el navegador lee varias tablas directo con la sesión.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La tabla
-- ----------------------------------------------------------------------------
create table if not exists public.order_mechanics (
  order_id    uuid        not null references public.orders(id)   on delete cascade,
  mechanic_id uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (order_id, mechanic_id)
);

comment on table public.order_mechanics is
  'Mecánicos asignados a una orden. Todos iguales, sin jerarquía. Es la '
  'fuente de verdad de la asignación desde la migración 0021; '
  'orders.assigned_mechanic_id es solo un espejo que mantiene un trigger.';

-- Para «¿qué órdenes son mías?», que es la consulta más repetida de la app.
create index if not exists order_mechanics_mechanic_idx
  on public.order_mechanics (mechanic_id);

-- ----------------------------------------------------------------------------
-- 2. Traer lo que ya estaba asignado
--    Cada orden con mecánico se convierte en una fila de la lista. Idempotente:
--    si la migración se corre dos veces, no duplica nada.
-- ----------------------------------------------------------------------------
insert into public.order_mechanics (order_id, mechanic_id, created_at)
select o.id, o.assigned_mechanic_id, o.created_at
from public.orders o
where o.assigned_mechanic_id is not null
on conflict (order_id, mechanic_id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. El espejo: mantener orders.assigned_mechanic_id y el estado
--
--    · assigned_mechanic_id = el primero que entró a la lista, o NULL.
--    · status: sin nadie → 'sin_mecanico'; con alguien → 'con_mecanico'.
--      Una orden ya marcada 'lista' NO se toca: que el taller reorganice
--      quién la atendió no la devuelve al taller.
-- ----------------------------------------------------------------------------
create or replace function public.sync_order_mechanic_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  uuid := coalesce(new.order_id, old.order_id);
  v_first  uuid;
begin
  select om.mechanic_id into v_first
  from public.order_mechanics om
  where om.order_id = v_order
  order by om.created_at, om.mechanic_id
  limit 1;

  update public.orders o
  set assigned_mechanic_id = v_first,
      status = case
                 when o.status = 'lista' then o.status
                 when v_first is null    then 'sin_mecanico'
                 else 'con_mecanico'
               end,
      updated_at = now()
  where o.id = v_order
    -- Sin esto, cada alta escribiría la misma fila otra vez sin necesidad.
    and (o.assigned_mechanic_id is distinct from v_first
         or o.status is distinct from case
                 when o.status = 'lista' then o.status
                 when v_first is null    then 'sin_mecanico'
                 else 'con_mecanico'
               end);

  return null;
end;
$$;

drop trigger if exists trg_order_mechanics_mirror on public.order_mechanics;
create trigger trg_order_mechanics_mirror
  after insert or delete on public.order_mechanics
  for each row execute function public.sync_order_mechanic_mirror();

-- Red de seguridad para el camino contrario: si algo crea una orden con
-- `assigned_mechanic_id` (código viejo, una carga manual), esa persona entra
-- igual en la lista. Así la lista nunca se queda vacía por detrás.
create or replace function public.seed_order_mechanic_from_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_mechanic_id is not null then
    insert into public.order_mechanics (order_id, mechanic_id)
    values (new.id, new.assigned_mechanic_id)
    on conflict (order_id, mechanic_id) do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orders_seed_mechanic on public.orders;
create trigger trg_orders_seed_mechanic
  after insert on public.orders
  for each row execute function public.seed_order_mechanic_from_column();

-- ----------------------------------------------------------------------------
-- 4. «¿Esta orden es mía?» — ahora se pregunta a la lista
--    Mismo nombre y mismo contrato que en la 0019; lo único que cambia es que
--    «asignada a mí» pasó de una columna a una fila de order_mechanics. Todas
--    las políticas que ya cuelgan de esta función (etapas, adjuntos,
--    presupuesto) heredan el cambio sin tocarlas.
-- ----------------------------------------------------------------------------
create or replace function public.order_is_mine(oid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = oid
      and o.workshop_id = public.current_workshop_id()
      and (
        public.is_admin()
        or exists (
          select 1 from public.order_mechanics om
          where om.order_id = o.id and om.mechanic_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.order_is_mine(uuid) from public, anon;
grant execute on function public.order_is_mine(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. orders — leer y actualizar según la lista, no según la columna
-- ----------------------------------------------------------------------------
drop policy if exists "staff can read orders" on public.orders;
create policy "staff can read orders"
  on public.orders for select
  using (
    public.is_staff()
    and workshop_id = public.current_workshop_id()
    and public.order_is_mine(id)
  );

-- El mecánico actualiza una orden suya y tiene que seguir siéndolo después
-- (el `with check`): no puede sacarse de encima una orden editándola.
drop policy if exists "mechanic can update assigned order" on public.orders;
create policy "mechanic can update assigned order"
  on public.orders for update
  using (
    public.is_staff()
    and workshop_id = public.current_workshop_id()
    and public.order_is_mine(id)
  )
  with check (
    public.is_staff()
    and workshop_id = public.current_workshop_id()
    and public.order_is_mine(id)
  );

-- La de admin (0014) y la de insert (0019) no cambian.

-- ----------------------------------------------------------------------------
-- 6. RLS de la tabla nueva
--    Leer: el admin de su taller y el mecánico de sus órdenes — un mecánico SÍ
--    debe ver con quién comparte el carro. Escribir: solo el administrador.
-- ----------------------------------------------------------------------------
alter table public.order_mechanics enable row level security;

drop policy if exists "staff can read order mechanics" on public.order_mechanics;
create policy "staff can read order mechanics"
  on public.order_mechanics for select
  using (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "admin can assign mechanics" on public.order_mechanics;
create policy "admin can assign mechanics"
  on public.order_mechanics for insert
  with check (public.is_admin() and public.order_in_my_workshop(order_id));

drop policy if exists "admin can unassign mechanics" on public.order_mechanics;
create policy "admin can unassign mechanics"
  on public.order_mechanics for delete
  using (public.is_admin() and public.order_in_my_workshop(order_id));

-- No hay política de UPDATE a propósito: una asignación se pone o se quita,
-- no se edita. Sin política, UPDATE queda prohibido para todos.

revoke all on table public.order_mechanics from anon;
grant select, insert, delete on table public.order_mechanics to authenticated;
grant all on table public.order_mechanics to service_role;

notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 7. Qué esperar después de correr esto
--    `descuadran` tiene que dar 0: toda orden con mecánico quedó en la lista y
--    el espejo apunta al mismo. Y `con_varios` es 0 todavía (nadie ha asignado
--    un segundo mecánico aún).
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.orders)                                as ordenes,
  (select count(*) from public.order_mechanics)                       as asignaciones,
  (select count(distinct order_id) from public.order_mechanics)       as ordenes_con_mecanico,
  (select count(*) from (
     select order_id from public.order_mechanics
     group by order_id having count(*) > 1) q)                        as con_varios,
  (select count(*) from public.orders o
    where o.assigned_mechanic_id is distinct from (
      select om.mechanic_id from public.order_mechanics om
      where om.order_id = o.id
      order by om.created_at, om.mechanic_id limit 1))                as descuadran;
