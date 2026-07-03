-- ============================================================================
-- Formula Taller — Límite del plan gratuito configurable
-- ============================================================================
-- Antes: cada taller tenía un order_limit fijo (default 3), solo editable por SQL.
-- Ahora:
--   * platform_settings.free_order_limit = límite GLOBAL del plan gratuito
--     (base y valor por defecto para talleres nuevos), editable desde el panel.
--   * workshops.order_limit = OVERRIDE opcional por taller (null = usar el global).
--   Límite efectivo de un taller no suscrito = order_limit ?? free_order_limit.
--   Los talleres suscritos (is_subscribed) siguen siendo ilimitados.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

-- Configuración global de la plataforma (fila única id = 1).
create table if not exists public.platform_settings (
  id               int primary key default 1 check (id = 1),
  free_order_limit int not null default 3,
  updated_at       timestamptz not null default now()
);

insert into public.platform_settings (id) values (1)
  on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- Lectura pública del límite (no es dato sensible: las vistas de admin/mecánico
-- lo leen con el cliente normal). La escritura es solo vía service_role (panel).
drop policy if exists "anyone can read platform settings" on public.platform_settings;
create policy "anyone can read platform settings"
  on public.platform_settings for select
  using (true);

drop trigger if exists trg_platform_settings_updated_at on public.platform_settings;
create trigger trg_platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- workshops.order_limit pasa a ser un override opcional (null = usar el global).
alter table public.workshops alter column order_limit drop default;
alter table public.workshops alter column order_limit drop not null;

-- Los talleres existentes tenían el valor por defecto 3 (no había forma de
-- editarlo desde la app): pasarlos a null para que sigan el límite global. Se
-- respetan valores personalizados (p. ej. desbloqueos manuales con otro número).
update public.workshops set order_limit = null where order_limit = 3;
