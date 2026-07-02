-- ============================================================================
-- Formula Taller — Nuevas etapas por defecto
-- ============================================================================
-- Reemplaza las etapas que se crean automáticamente al abrir una orden.
-- Solo afecta a órdenes NUEVAS; las etapas siguen siendo editables/movibles.
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

create or replace function public.seed_default_stages()
returns trigger
language plpgsql
as $$
begin
  insert into public.order_stages (order_id, name, position, status, completed_at) values
    (new.id, 'Diagnóstico',           1, 'pending', null),
    (new.id, 'Desmontaje de piezas',  2, 'pending', null),
    (new.id, 'Reemplazo/Reparación',  3, 'pending', null),
    (new.id, 'Armado y prueba',       4, 'pending', null),
    (new.id, 'Vehículo listo',        5, 'pending', null);
  return new;
end;
$$;
