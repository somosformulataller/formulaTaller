-- ============================================================================
-- Formula Taller — Etiqueta "Test" para talleres de prueba
-- ============================================================================
-- Permite al superadmin marcar talleres creados como prueba (demos, QA, etc.)
-- para que no cuenten en el conteo total de talleres del panel de plataforma.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

alter table public.workshops
  add column if not exists is_test boolean not null default false;

comment on column public.workshops.is_test is
  'Taller marcado como prueba por un superadmin: se excluye del conteo total de talleres.';
