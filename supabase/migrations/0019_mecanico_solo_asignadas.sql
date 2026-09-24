-- ============================================================================
-- 0019 — El mecánico solo ve las órdenes que le asignaron
--
-- CÓMO ERA
-- Hasta ahora la única frontera era el taller: cualquier miembro (admin o
-- mecánico) veía y gestionaba TODAS las órdenes de su taller, podía asignarse
-- a sí mismo cualquiera y crear órdenes nuevas.
--
-- CÓMO QUEDA
--   · El mecánico ve y gestiona SOLO las órdenes asignadas a él.
--   · El mecánico NO puede asignarse a sí mismo: asignar es del administrador.
--   · El mecánico NO crea órdenes. Las crea el administrador y se las reparte.
--   · Las órdenes sin mecánico asignado las ve solo el administrador (no se
--     cambia ningún dato: cambia quién las ve).
--   · El administrador sigue viendo todo su taller, como hasta ahora.
--
-- El aislamiento entre talleres NO cambia: sigue igual de cerrado.
--
-- Esto se aplica en la base de datos Y en la API (src/lib/api-auth.ts). Hace
-- falta en los dos sitios: la API escribe con la clave de servicio, que se
-- salta RLS, así que estas políticas por sí solas no bastarían; y la API por sí
-- sola tampoco, porque el navegador lee varias tablas directo con la sesión del
-- usuario. Cada capa cierra lo que la otra no ve.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: ¿esta orden es MÍA?
--    Para el admin, «mía» = de mi taller. Para el mecánico, «mía» = asignada a
--    mí. Sustituye a order_in_my_workshop() en todo lo que cuelga de una orden.
--    SECURITY DEFINER para leer orders sin disparar su propia RLS (evita la
--    recursión), STABLE y con search_path fijo, igual que el resto de helpers.
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
      and (public.is_admin() or o.assigned_mechanic_id = auth.uid())
  );
$$;

revoke all on function public.order_is_mine(uuid) from public, anon;
grant execute on function public.order_is_mine(uuid) to authenticated, service_role;

-- order_in_my_workshop() se deja como está: no se toca por si algo la usa, y
-- su nombre sigue diciendo la verdad de lo que hace. Lo que cambia es QUIÉN la
-- usa: a partir de aquí, nada que cuelgue de una orden.

-- ----------------------------------------------------------------------------
-- 2. orders — leer y crear
-- ----------------------------------------------------------------------------
-- Leer: el admin, todo su taller; el mecánico, solo lo asignado a él.
drop policy if exists "staff can read orders" on public.orders;
create policy "staff can read orders"
  on public.orders for select
  using (
    public.is_staff()
    and workshop_id = public.current_workshop_id()
    and (public.is_admin() or assigned_mechanic_id = auth.uid())
  );

-- Crear: solo el administrador. Antes era cualquier staff; si el mecánico no
-- puede asignarse, tampoco debe poder crear una orden que nadie le asignó.
drop policy if exists "staff can insert orders" on public.orders;
drop policy if exists "admin can insert orders" on public.orders;
create policy "admin can insert orders"
  on public.orders for insert
  with check (public.is_admin() and workshop_id = public.current_workshop_id());

-- Las dos políticas de UPDATE de la 0014 ya dicen lo correcto y no se tocan:
-- el admin actualiza cualquier orden de su taller, y el mecánico solo una que
-- YA esté asignada a él (el `using` exige assigned_mechanic_id = auth.uid()
-- ANTES del cambio, así que una orden sin asignar no le entra, y el
-- `with check` lo exige DESPUÉS, así que tampoco puede pasársela a otro).

-- ----------------------------------------------------------------------------
-- 3. order_stages — cuelgan de la orden: misma regla
-- ----------------------------------------------------------------------------
drop policy if exists "staff can read stages" on public.order_stages;
create policy "staff can read stages"
  on public.order_stages for select
  using (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "staff can insert stages" on public.order_stages;
create policy "staff can insert stages"
  on public.order_stages for insert
  with check (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "admin can update any stage" on public.order_stages;
create policy "admin can update any stage"
  on public.order_stages for update
  using (public.is_admin() and public.order_is_mine(order_id))
  with check (public.is_admin() and public.order_is_mine(order_id));

drop policy if exists "mechanic can update stages of assigned order" on public.order_stages;
create policy "mechanic can update stages of assigned order"
  on public.order_stages for update
  using (public.is_staff() and public.order_is_mine(order_id))
  with check (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "admin can delete stages" on public.order_stages;
create policy "admin can delete stages"
  on public.order_stages for delete
  using (public.is_admin() and public.order_is_mine(order_id));

-- ----------------------------------------------------------------------------
-- 4. stage_attachments — igual
-- ----------------------------------------------------------------------------
drop policy if exists "staff can read attachments" on public.stage_attachments;
create policy "staff can read attachments"
  on public.stage_attachments for select
  using (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "staff can insert attachments" on public.stage_attachments;
create policy "staff can insert attachments"
  on public.stage_attachments for insert
  with check (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "staff can delete attachments" on public.stage_attachments;
create policy "staff can delete attachments"
  on public.stage_attachments for delete
  using (public.is_staff() and public.order_is_mine(order_id));

-- ----------------------------------------------------------------------------
-- 5. order_budget_items — igual (el presupuesto de una orden ajena tampoco)
-- ----------------------------------------------------------------------------
drop policy if exists "staff can read budget items" on public.order_budget_items;
create policy "staff can read budget items"
  on public.order_budget_items for select
  using (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "staff can insert budget items" on public.order_budget_items;
create policy "staff can insert budget items"
  on public.order_budget_items for insert
  with check (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "staff can update budget items" on public.order_budget_items;
create policy "staff can update budget items"
  on public.order_budget_items for update
  using (public.is_staff() and public.order_is_mine(order_id))
  with check (public.is_staff() and public.order_is_mine(order_id));

drop policy if exists "staff can delete budget items" on public.order_budget_items;
create policy "staff can delete budget items"
  on public.order_budget_items for delete
  using (public.is_staff() and public.order_is_mine(order_id));

notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 6. Qué esperar después de correr esto
-- ----------------------------------------------------------------------------
-- Cuántas órdenes deja de ver cada mecánico (las de su taller que NO son
-- suyas), y cuántas quedan sin asignar y por tanto solo para el administrador.
select
  (select count(*) from public.orders where assigned_mechanic_id is null) as sin_asignar,
  (select count(*) from public.orders where assigned_mechanic_id is not null) as asignadas,
  (select count(*) from public.profiles where role = 'mechanic') as mecanicos;
