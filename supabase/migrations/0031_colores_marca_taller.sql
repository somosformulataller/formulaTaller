-- ============================================================================
-- Formula Taller — Colores de la marca del taller (0031)
-- ============================================================================
-- Al subir el logo se detectan sus colores principales (en el navegador) y se
-- guardan aquí. Con ellos se pinta la cabecera del seguimiento y del enlace
-- del presupuesto que ve el cliente. El administrador los puede cambiar en el
-- Perfil del Taller. null = colores de Formula Taller.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------
alter table public.workshops
  add column if not exists brand_color text,
  add column if not exists brand_color_2 text;

alter table public.workshops drop constraint if exists workshops_brand_color_hex;
alter table public.workshops add constraint workshops_brand_color_hex
  check ((brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$')
     and (brand_color_2 is null or brand_color_2 ~ '^#[0-9a-fA-F]{6}$'));
