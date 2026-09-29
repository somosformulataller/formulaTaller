-- ============================================================================
-- 0022 — Recuperar la contraseña sin salir de la pantalla
--
-- El administrador de un taller que olvidó su contraseña escribe su correo,
-- el WhatsApp y el nombre del taller con que se registró. Si los tres cuadran,
-- elige una contraseña nueva ahí mismo, sin enlace por correo (el correo
-- integrado de Supabase manda muy pocos por hora y ahí se pierde a la gente).
--
-- Es el mismo esquema de La Mejor Llave (su migración 023). El WhatsApp y el
-- nombre del taller NO son secretos —los clientes los conocen—, así que esta
-- puerta va acompañada del corte por intentos y de la bitácora.
--
-- Dos piezas, las dos solo accesibles con la clave de servicio:
--   1. password_reset_attempts — TODO intento queda apuntado.
--   2. password_reset_grants   — el permiso de un solo uso entre «tus datos
--      cuadran» y «esta es mi contraseña nueva».
--
-- Se corre en el SQL Editor de Supabase. Es idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bitácora de intentos (los fallidos también: dicen si alguien está
--    probando datos a ver cuál cuela)
-- ----------------------------------------------------------------------------
create table if not exists public.password_reset_attempts (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  email       text not null,
  -- Solo si se encontró la cuenta. Si se borra, la fila se queda.
  user_id     uuid references auth.users (id) on delete set null,
  ip          text,
  resultado   text not null check (resultado in (
    'verificado',   -- los tres datos cuadran; se entregó el permiso
    'no_coincide',  -- la cuenta existe pero los datos no
    'sin_cuenta',   -- no hay cuenta con ese correo
    'no_admin',     -- es un mecánico o un superadmin: por aquí no se recupera
    'inactivo',     -- la cuenta está desactivada
    'frenado',      -- se pasó del límite de intentos
    'cambiada'      -- se completó el cambio de contraseña
  ))
);

create index if not exists password_reset_attempts_email_idx
  on public.password_reset_attempts (email, created_at desc);
create index if not exists password_reset_attempts_ip_idx
  on public.password_reset_attempts (ip, created_at desc);

alter table public.password_reset_attempts enable row level security;
revoke select, insert, update, delete on public.password_reset_attempts from anon, authenticated;
revoke usage, select on sequence public.password_reset_attempts_id_seq from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Permisos de un solo uso. Del token solo se guarda su huella (SHA-256):
--    quien leyera esta tabla no podría usar lo que ve. Dura 10 minutos.
-- ----------------------------------------------------------------------------
create table if not exists public.password_reset_grants (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  token_hash  text not null unique,
  user_id     uuid not null references auth.users (id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  ip          text
);

create index if not exists password_reset_grants_user_idx
  on public.password_reset_grants (user_id, created_at desc);

alter table public.password_reset_grants enable row level security;
revoke select, insert, update, delete on public.password_reset_grants from anon, authenticated;
revoke usage, select on sequence public.password_reset_grants_id_seq from anon, authenticated;
