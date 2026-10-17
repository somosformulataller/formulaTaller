-- ============================================================================
-- Formula Taller — Modelo del carro en el cliente (0029)
-- ============================================================================
-- Desde Clientes se puede agregar un cliente sin orden ni presupuesto. Su
-- carro se guarda aquí; cuando tiene órdenes, la lista muestra el de la más
-- reciente.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------
alter table public.clients add column if not exists car_model text;
