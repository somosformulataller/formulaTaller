-- ============================================================================
-- Formula Taller — Branding por taller (logo + enlace de login personalizado)
-- ============================================================================
-- Agrega a cada taller un logo y un "slug" único para su URL de login propia
-- (ej. /login/taller-el-rayo). Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

create extension if not exists unaccent with schema extensions;

alter table public.workshops add column if not exists logo_url text;
alter table public.workshops add column if not exists slug text;

-- ----------------------------------------------------------------------------
-- Backfill de slugs a partir del nombre (sin acentos, minúsculas, con guiones)
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  base text;
  final text;
begin
  for r in select id, name from public.workshops where slug is null loop
    base := trim(both '-' from
      regexp_replace(extensions.unaccent(lower(r.name)), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'taller'; end if;

    final := base;
    -- Si ya existe ese slug, agregar un sufijo corto del id.
    if exists (select 1 from public.workshops where slug = final) then
      final := base || '-' || left(replace(r.id::text, '-', ''), 4);
    end if;

    update public.workshops set slug = final where id = r.id;
  end loop;
end $$;

-- Slug obligatorio y único (la app lo genera al registrar un taller).
alter table public.workshops alter column slug set not null;
create unique index if not exists workshops_slug_idx on public.workshops (slug);
