-- ============================================================================
-- Formula Taller — Conteo de órdenes por taller en el servidor (agregado)
-- ============================================================================
-- El panel de superadmin contaba las órdenes trayéndolas todas y contándolas en
-- JavaScript (src/app/superadmin/page.tsx). PostgREST corta en 1000 filas por
-- defecto y sin avisar, así que en cuanto la plataforma supere 1000 órdenes EN
-- TOTAL, tanto la métrica global como el "X / límite" de cada taller quedaban
-- mal —un taller que va por 40 podía mostrarse como 0—, y el superadmin decidía
-- cobros sobre un número falso. (Auditoría 15/09/2026, hallazgo 5.)
--
-- La cuenta correcta se hace en Postgres con GROUP BY, que no tiene ese tope.
--
-- Acceso: solo la plataforma (service_role) puede ejecutarla. Se revoca a anon y
-- authenticated para que ningún usuario normal pueda sacar el conteo de todos
-- los talleres con la anon key.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

create or replace function public.admin_order_counts_by_workshop()
returns table (workshop_id uuid, order_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select workshop_id, count(*)::bigint
  from public.orders
  group by workshop_id;
$$;

-- Por defecto Postgres concede EXECUTE a PUBLIC: hay que quitarlo.
revoke all on function public.admin_order_counts_by_workshop() from public;
revoke all on function public.admin_order_counts_by_workshop() from anon;
revoke all on function public.admin_order_counts_by_workshop() from authenticated;
grant execute on function public.admin_order_counts_by_workshop() to service_role;
