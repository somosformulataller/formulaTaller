-- ============================================================================
-- Formula Taller — Enlace del presupuesto para el cliente (0030)
-- ============================================================================
-- Como el seguimiento de la orden, el presupuesto suelto (0028) tiene ahora su
-- enlace público (/tracking/presupuesto/<public_token>). Ahí el cliente:
--   - aprueba o rechaza el presupuesto;
--   - si el taller lo dejó elegir (client_picks_date), escoge el día y la hora
--     de su cita; si no, acepta o rechaza la cita que puso el taller.
-- Cada respuesta le llega al taller como notificación (con quote_id).
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

alter table public.quotes
  add column if not exists public_token uuid not null default extensions.gen_random_uuid(),
  add column if not exists client_picks_date boolean not null default false,
  add column if not exists client_decision text not null default 'pendiente',
  add column if not exists decided_at timestamptz;

create unique index if not exists quotes_public_token_idx on public.quotes (public_token);

alter table public.quotes drop constraint if exists quotes_client_decision_valid;
alter table public.quotes add constraint quotes_client_decision_valid
  check (client_decision in ('pendiente', 'aprobado', 'rechazado'));

-- Respuesta del cliente a la cita: pendiente, confirmada o rechazada.
alter table public.appointments
  add column if not exists status text not null default 'pendiente',
  add column if not exists chosen_by_client boolean not null default false;

alter table public.appointments drop constraint if exists appointments_status_valid;
alter table public.appointments add constraint appointments_status_valid
  check (status in ('pendiente', 'confirmada', 'rechazada'));

-- Las notificaciones del presupuesto suelto llevan a él (no hay orden todavía).
alter table public.notifications
  add column if not exists quote_id uuid references public.quotes (id) on delete cascade;
create index if not exists notifications_quote_idx on public.notifications (quote_id);
