-- Fase F1: descripción opcional por etapa del servicio.
-- Idempotente: se puede correr varias veces sin romper nada.
alter table public.order_stages
  add column if not exists description text;
