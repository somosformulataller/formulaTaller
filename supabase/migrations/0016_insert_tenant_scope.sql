-- ============================================================================
-- Formula Taller — INSERT con alcance por taller (defensa en profundidad)
-- ============================================================================
-- Cierra el hallazgo menor 11 de la auditoría 15/09/2026: las políticas de
-- INSERT de orders y profiles solo pedían is_staff()/is_admin(), sin comprobar
-- el taller. Un usuario podía, por la API REST directa, crear una orden o un
-- perfil con el workshop_id de OTRO taller (y saltarse de paso el conteo de
-- límite que hace la app en el servidor).
--
-- La app NO se ve afectada: crea órdenes y perfiles con el service client
-- (register, /api/orders, /api/mechanics), que pasa por encima de RLS. Esto es
-- defensa en profundidad para el acceso directo a PostgREST.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

-- orders: solo se pueden crear en el propio taller.
drop policy if exists "staff can insert orders" on public.orders;
create policy "staff can insert orders"
  on public.orders for insert
  with check (public.is_staff() and workshop_id = public.current_workshop_id());

-- profiles: el admin solo puede crear perfiles en su propio taller.
drop policy if exists "admin can insert profiles" on public.profiles;
create policy "admin can insert profiles"
  on public.profiles for insert
  with check (public.is_admin() and workshop_id = public.current_workshop_id());
