-- ============================================================================
-- 0020 — La dueña puede quedarse la orden «como el taller» o «como ella»
--
-- POR QUÉ
-- Desde la 0019 el dueño del taller aparece en la lista de asignación, porque
-- muchos dueños también reparan carros. Pero el nombre del mecánico asignado
-- NO es un dato interno: se lo enseñamos al CLIENTE en su enlace de
-- seguimiento. Y no es lo mismo que el cliente lea «Samuel Emilio» que
-- «Mulservicios MOTORSAM 3000».
--
-- Así que en la lista de asignación el dueño sale DOS VECES: con el nombre del
-- taller y con el suyo. Las dos asignan la orden a la misma persona —el dato
-- de quién trabaja el carro no cambia— y lo que cambia es el nombre que ve el
-- cliente. Esta columna es lo que guarda esa decisión.
--
-- Sin ella, las dos entradas escribirían exactamente lo mismo y al reabrir la
-- orden serían indistinguibles: un espejismo.
--
-- `false` por defecto = el comportamiento de siempre (se ve la persona), así
-- que ninguna orden existente cambia de aspecto.
-- ============================================================================

alter table public.orders
  add column if not exists show_workshop_as_mechanic boolean not null default false;

comment on column public.orders.show_workshop_as_mechanic is
  'true = en el seguimiento del cliente, donde va el nombre del mecánico se '
  'enseña el nombre del taller. Solo tiene sentido cuando la orden está '
  'asignada al dueño (ver migración 0020).';

notify pgrst, 'reload schema';

-- Cuántas órdenes hay hoy y cuántas quedarían mostrando el taller (debe ser 0:
-- la columna nace en false para todas).
select
  count(*) as ordenes,
  count(*) filter (where show_workshop_as_mechanic) as muestran_el_taller
from public.orders;
