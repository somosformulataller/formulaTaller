-- ============================================================================
-- Formula Taller — Números de atención al cliente (para el paywall)
-- ============================================================================
-- Lista global de números a los que el usuario escribe para pagar la
-- suscripción. Se muestran en el mensaje del límite del plan gratuito y se
-- gestionan (agregar/editar/eliminar) desde el panel de superadmin.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

alter table public.platform_settings
  add column if not exists support_phones text[] not null default '{}';

-- Sembrar el número actual si aún no hay ninguno configurado.
update public.platform_settings
  set support_phones = array['04242349786']
  where id = 1
    and (support_phones is null or array_length(support_phones, 1) is null);
