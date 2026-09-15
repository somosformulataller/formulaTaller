-- ============================================================================
-- Formula Taller — Endurecer el aislamiento entre talleres (multi-tenant)
-- ============================================================================
-- Cierra tres agujeros de RLS encontrados en la auditoría del 15/09/2026
-- (ver AUDITORIA-SEGURIDAD-2026-09-15.md). 0013 ya cerró la lectura ANÓNIMA;
-- esto cierra el acceso CRUZADO ENTRE TALLERES de un usuario ya autenticado.
--
--   Crítico 3 — order_stages y stage_attachments no filtraban por taller: sus
--     políticas solo pedían is_staff(). Un mecánico de cualquier taller leía
--     las 126 etapas y 43 adjuntos de los 18 talleres (comprobado en vivo).
--     Estas tablas no tienen workshop_id, pero SÍ tienen order_id, así que se
--     filtran por el taller de la ORDEN padre (fuente de verdad, no falsificable
--     por el cliente, sin backfill).
--
--   Crítico 2 — profiles.role / profiles.workshop_id se podían auto-editar: las
--     políticas de UPDATE tenían USING pero no WITH CHECK. Un mecánico podía
--     hacerse admin o mudarse a otro taller. Se arregla con WITH CHECK (alcance
--     por taller) + un trigger que impide cambiar esas dos columnas salvo al
--     service_role (la app en el servidor).
--
--   Alto 4 — orders/workshops UPDATE sin WITH CHECK: un admin podía mover una
--     orden a otro taller, o ponerse is_subscribed=true (saltar el paywall).
--     Se arregla con WITH CHECK (alcance por taller) + un trigger que blinda las
--     columnas sensibles del taller (is_subscribed, order_limit, is_test, owner_id).
--
-- Detección de "es la app en el servidor": PostgREST hace SET ROLE service_role
-- para las peticiones con la service key, así que current_user = 'service_role'.
-- Un usuario normal entra como 'authenticated'. Los triggers son SECURITY INVOKER
-- (por defecto) para que current_user refleje a quien llama de verdad.
--
-- Seguro de correr más de una vez (idempotente). No requiere cambios en el código
-- de la app: las escrituras legítimas van por el service client o tocan columnas
-- permitidas.
-- ----------------------------------------------------------------------------


-- ============================================================================
-- 0. Red de seguridad: reafirmar que la lectura anónima sigue cerrada
--    (0013 ya las borró; se repite por si alguien reejecutó SETUP.sql encima).
-- ============================================================================
drop policy if exists "anon can read order by token" on public.orders;
drop policy if exists "anon can read stages" on public.order_stages;


-- ============================================================================
-- 1. Helper: ¿la orden <oid> pertenece al taller del usuario actual?
--    SECURITY DEFINER para leer orders SIN disparar su propia RLS (evita
--    recursión y no depende de las políticas de orders). STABLE + search_path
--    fijo, igual que el resto de helpers del proyecto.
-- ============================================================================
create or replace function public.order_in_my_workshop(oid uuid)
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
  );
$$;


-- ============================================================================
-- 2. order_stages — aislar por el taller de la orden padre
-- ============================================================================
drop policy if exists "staff can read stages" on public.order_stages;
create policy "staff can read stages"
  on public.order_stages for select
  using (public.is_staff() and public.order_in_my_workshop(order_id));

drop policy if exists "staff can insert stages" on public.order_stages;
create policy "staff can insert stages"
  on public.order_stages for insert
  with check (public.is_staff() and public.order_in_my_workshop(order_id));

drop policy if exists "admin can update any stage" on public.order_stages;
create policy "admin can update any stage"
  on public.order_stages for update
  using (public.is_admin() and public.order_in_my_workshop(order_id))
  with check (public.is_admin() and public.order_in_my_workshop(order_id));

drop policy if exists "mechanic can update stages of assigned order" on public.order_stages;
create policy "mechanic can update stages of assigned order"
  on public.order_stages for update
  using (
    public.is_staff()
    and public.order_in_my_workshop(order_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.assigned_mechanic_id = auth.uid()
    )
  )
  with check (
    public.is_staff()
    and public.order_in_my_workshop(order_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.assigned_mechanic_id = auth.uid()
    )
  );

drop policy if exists "admin can delete stages" on public.order_stages;
create policy "admin can delete stages"
  on public.order_stages for delete
  using (public.is_admin() and public.order_in_my_workshop(order_id));


-- ============================================================================
-- 3. stage_attachments — aislar por el taller de la orden padre
--    (tiene order_id directo; ver 0004_stage_attachments.sql)
-- ============================================================================
drop policy if exists "staff can read attachments" on public.stage_attachments;
create policy "staff can read attachments"
  on public.stage_attachments for select
  using (public.is_staff() and public.order_in_my_workshop(order_id));

drop policy if exists "staff can insert attachments" on public.stage_attachments;
create policy "staff can insert attachments"
  on public.stage_attachments for insert
  with check (public.is_staff() and public.order_in_my_workshop(order_id));

drop policy if exists "staff can delete attachments" on public.stage_attachments;
create policy "staff can delete attachments"
  on public.stage_attachments for delete
  using (public.is_staff() and public.order_in_my_workshop(order_id));


-- ============================================================================
-- 4. orders — añadir WITH CHECK a las UPDATE (impide mover la orden de taller)
-- ============================================================================
drop policy if exists "admin can update any order" on public.orders;
create policy "admin can update any order"
  on public.orders for update
  using (public.is_admin() and workshop_id = public.current_workshop_id())
  with check (public.is_admin() and workshop_id = public.current_workshop_id());

drop policy if exists "mechanic can update assigned order" on public.orders;
create policy "mechanic can update assigned order"
  on public.orders for update
  using (
    public.is_staff()
    and workshop_id = public.current_workshop_id()
    and assigned_mechanic_id = auth.uid()
  )
  with check (
    public.is_staff()
    and workshop_id = public.current_workshop_id()
    and assigned_mechanic_id = auth.uid()
  );


-- ============================================================================
-- 5. profiles — WITH CHECK de alcance por taller en las UPDATE
--    (el bloqueo fino de columnas role/workshop_id va en el trigger del punto 7)
-- ============================================================================
drop policy if exists "admin can update any profile" on public.profiles;
create policy "admin can update any profile"
  on public.profiles for update
  using (public.is_admin() and workshop_id = public.current_workshop_id())
  with check (public.is_admin() and workshop_id = public.current_workshop_id());

drop policy if exists "mechanic can update own profile" on public.profiles;
create policy "mechanic can update own profile"
  on public.profiles for update
  using (auth.uid() = id and public.is_staff())
  with check (auth.uid() = id and public.is_staff()
              and workshop_id = public.current_workshop_id());


-- ============================================================================
-- 6. workshops — WITH CHECK de alcance en la UPDATE del admin
--    (el bloqueo de columnas sensibles va en el trigger del punto 7)
-- ============================================================================
drop policy if exists "admin can update own workshop" on public.workshops;
create policy "admin can update own workshop"
  on public.workshops for update
  using (public.is_admin() and id = public.current_workshop_id())
  with check (public.is_admin() and id = public.current_workshop_id());


-- ============================================================================
-- 7. Triggers de columna: lo que RLS no puede hacer (proteger COLUMNAS).
--    Solo el service_role (la app en el servidor) puede tocar estas columnas.
-- ============================================================================

-- profiles: nadie que no sea la app cambia su propio rol ni su taller.
create or replace function public.guard_profile_privileged_cols()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'No se permite cambiar el rol del perfil';
  end if;
  if new.workshop_id is distinct from old.workshop_id then
    raise exception 'No se permite cambiar el taller del perfil';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_cols on public.profiles;
create trigger trg_guard_profile_cols
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_cols();

-- workshops: la suscripción, el límite, la etiqueta de prueba y el dueño solo
-- los cambia la plataforma (superadmin, vía service_role). Esto es lo que
-- convierte el paywall en una frontera real: un admin ya no puede ponerse
-- is_subscribed=true por la API.
create or replace function public.guard_workshop_privileged_cols()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if new.is_subscribed is distinct from old.is_subscribed
     or new.order_limit  is distinct from old.order_limit
     or new.is_test      is distinct from old.is_test
     or new.owner_id     is distinct from old.owner_id then
    raise exception 'Estos campos del taller solo los cambia la plataforma';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_workshop_cols on public.workshops;
create trigger trg_guard_workshop_cols
  before update on public.workshops
  for each row execute function public.guard_workshop_privileged_cols();
