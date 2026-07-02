-- ============================================================================
-- Formula Taller — Límite de órdenes por taller (plan gratuito)
-- ============================================================================
-- Cada taller puede crear hasta `order_limit` órdenes (3 por defecto). Para
-- desbloquear a un taller que pague, subir su `order_limit` por SQL, ej.:
--   update public.workshops set order_limit = 100000 where slug = 'taller-x';
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

alter table public.workshops
  add column if not exists order_limit integer not null default 3;
