-- Fase F2: adjuntos (fotos/documentos) por etapa del servicio.
-- Idempotente: se puede correr varias veces.

-- 1. Tabla de adjuntos
create table if not exists public.stage_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  stage_id uuid not null references public.order_stages(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  path text not null,
  url text not null,
  name text,
  mime text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists stage_attachments_stage_id_idx
  on public.stage_attachments (stage_id);

alter table public.stage_attachments enable row level security;

-- Políticas (las escrituras reales van por service client, pero dejamos RLS coherente)
drop policy if exists "staff can read attachments" on public.stage_attachments;
create policy "staff can read attachments"
  on public.stage_attachments for select
  using (public.is_staff());

drop policy if exists "staff can insert attachments" on public.stage_attachments;
create policy "staff can insert attachments"
  on public.stage_attachments for insert
  with check (public.is_staff());

drop policy if exists "staff can delete attachments" on public.stage_attachments;
create policy "staff can delete attachments"
  on public.stage_attachments for delete
  using (public.is_staff());

-- 2. Bucket de almacenamiento público (para que las fotos carguen en el tracking)
insert into storage.buckets (id, name, public)
values ('stage-files', 'stage-files', true)
on conflict (id) do nothing;
