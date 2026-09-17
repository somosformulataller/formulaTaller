-- ============================================================================
-- Formula Taller — CRM de ventas (panel superadmin)
-- ============================================================================
-- Da al equipo de Formula Taller herramientas para hacerle seguimiento a los
-- talleres que se registran: etiquetas reutilizables, marca de "video tutorial
-- enviado" y los textos/enlace del onboarding.
--
-- Todo vive detrás del panel superadmin y se opera con el service_role. Por eso
-- las tablas tienen RLS activado pero SIN políticas para anon/authenticated:
-- nadie salvo el service_role (que salta RLS) puede leerlas o escribirlas, igual
-- que platform_settings / platform_admins.
--
-- Idempotente: seguro de correr más de una vez.
-- ----------------------------------------------------------------------------

-- 1. Catálogo de etiquetas (se crean/renombran/borran desde el panel).
create table if not exists public.crm_tags (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(label) between 1 and 40),
  color      text not null default 'neutral'
             check (color in ('neutral', 'gold', 'green', 'red', 'blue')),
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- Una etiqueta por nombre (sin importar mayúsculas): evita "Registrado" y
-- "registrado" como dos etiquetas distintas.
create unique index if not exists crm_tags_label_unique
  on public.crm_tags (lower(label));

-- 2. Asignación etiqueta <-> taller (muchos a muchos).
create table if not exists public.workshop_tags (
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  tag_id      uuid not null references public.crm_tags (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (workshop_id, tag_id)
);
create index if not exists workshop_tags_workshop_idx
  on public.workshop_tags (workshop_id);
create index if not exists workshop_tags_tag_idx
  on public.workshop_tags (tag_id);

-- 3. Marca de cuándo se le envió el video tutorial al taller (para ordenar,
--    mostrar el estado y no reenviar sin querer).
alter table public.workshops
  add column if not exists tutorial_sent_at timestamptz;

-- 4. Enlace del video y mensaje por defecto del onboarding (editables en el panel).
alter table public.platform_settings
  add column if not exists tutorial_video_url text,
  add column if not exists tutorial_message   text;

-- Mensaje por defecto (solo si aún no hay uno).
update public.platform_settings
  set tutorial_message =
    'Gracias por registrarte en Formula Taller. Aquí te enviamos un video ' ||
    'explicativo para que crees tu primera orden. Tienes 30 órdenes ' ||
    'completamente gratis, lo puedes usar con tus clientes.'
  where id = 1 and tutorial_message is null;

-- Enlace del video de bienvenida (ya subido al bucket público "tutorials").
-- Se puede cambiar luego desde el panel de Ventas.
update public.platform_settings
  set tutorial_video_url =
    'https://tsvaagakjkemavhdcroy.supabase.co/storage/v1/object/public/tutorials/onboarding.mp4'
  where id = 1 and tutorial_video_url is null;

-- 5. RLS: solo el service_role (panel superadmin).
alter table public.crm_tags       enable row level security;
alter table public.workshop_tags  enable row level security;
revoke all on public.crm_tags      from anon, authenticated;
revoke all on public.workshop_tags from anon, authenticated;

-- 6. Etiquetas iniciales.
insert into public.crm_tags (label, color, sort) values
  ('Registrado',    'blue',   1),
  ('Video enviado', 'gold',   2),
  ('Respondió',     'green',  3),
  ('Cliente activo','green',  4),
  ('Sin interés',   'red',    5)
on conflict (lower(label)) do nothing;
