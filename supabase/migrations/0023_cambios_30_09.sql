-- ============================================================================
-- Formula Taller — Cambios 30-09
-- ============================================================================
--  1. Presupuesto: costo del repuesto/servicio + mano de obra, y decisión del
--     cliente (aprobar / rechazar) desde el enlace de seguimiento.
--  2. Notificaciones al administrador del taller.
--  3. Clientes (uno por WhatsApp dentro de cada taller) y orders.client_id.
--  4. Recordatorios con etiquetas, nota de voz, transcripción e imagen.
--  5. Condiciones previas del vehículo (checklist editable desde el superadmin).
--  6. Registro de uso del asistente IA.
--
-- Todo se lee y escribe desde las API con la clave de servicio, que vuelven a
-- comprobar el taller de quien llama. RLS queda activado en todas las tablas
-- nuevas, con lectura solo para el personal del propio taller.
--
-- Seguro de correr más de una vez (idempotente).
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 1. Presupuesto
-- ============================================================================
alter table public.order_budget_items
  add column if not exists labor_amount numeric(12,2) not null default 0,
  add column if not exists client_decision text not null default 'pendiente',
  add column if not exists decided_at timestamptz,
  -- Cuándo el taller cambió el monto de un ítem que el cliente ya había
  -- decidido: la decisión vuelve a «pendiente» y el cliente lo ve «actualizado».
  add column if not exists revised_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_budget_items_labor_positive') then
    alter table public.order_budget_items
      add constraint order_budget_items_labor_positive check (labor_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_budget_items_decision_valid') then
    alter table public.order_budget_items
      add constraint order_budget_items_decision_valid
      check (client_decision in ('pendiente', 'aprobado', 'rechazado'));
  end if;
end $$;

comment on column public.order_budget_items.amount is 'Costo del repuesto o servicio (USD).';
comment on column public.order_budget_items.labor_amount is 'Costo de la mano de obra (USD).';

-- Si el taller cambia un monto ya decidido, la decisión se reinicia.
create or replace function public.budget_item_reset_decision()
returns trigger
language plpgsql
as $$
begin
  if (new.amount is distinct from old.amount or new.labor_amount is distinct from old.labor_amount)
     and old.client_decision <> 'pendiente'
     and new.client_decision = old.client_decision then
    new.client_decision := 'pendiente';
    new.decided_at := null;
    new.revised_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_budget_item_reset_decision on public.order_budget_items;
create trigger trg_budget_item_reset_decision
  before update on public.order_budget_items
  for each row execute function public.budget_item_reset_decision();

-- Historial de decisiones del cliente («aprobó», luego «rechazó»…).
create table if not exists public.budget_decisions (
  id          uuid primary key default extensions.gen_random_uuid(),
  item_id     uuid references public.order_budget_items (id) on delete set null,
  order_id    uuid not null references public.orders (id) on delete cascade,
  description text not null,
  decision    text not null check (decision in ('aprobado', 'rechazado')),
  created_at  timestamptz not null default now()
);
create index if not exists budget_decisions_order_idx on public.budget_decisions (order_id, created_at desc);

alter table public.budget_decisions enable row level security;
drop policy if exists "staff can read budget decisions" on public.budget_decisions;
create policy "staff can read budget decisions"
  on public.budget_decisions for select
  using (public.is_staff() and public.order_in_my_workshop(order_id));

-- ============================================================================
-- 2. Notificaciones al administrador
-- ============================================================================
create table if not exists public.notifications (
  id          uuid primary key default extensions.gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete cascade,
  kind        text not null default 'presupuesto',
  message     text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_workshop_idx
  on public.notifications (workshop_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "admin can read notifications" on public.notifications;
create policy "admin can read notifications"
  on public.notifications for select
  using (public.is_admin() and workshop_id = public.current_workshop_id());

-- ============================================================================
-- 3. Clientes
-- ============================================================================
-- Misma regla que waNumber() en src/lib/whatsapp.ts.
create or replace function public.wa_digits(raw text)
returns text
language plpgsql
immutable
as $$
declare d text;
begin
  d := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  if d = '' then return null; end if;
  if length(d) = 11 and left(d, 1) = '0' then return '58' || substr(d, 2); end if;
  if length(d) = 10 and left(d, 1) = '4' then return '58' || d; end if;
  return d;
end;
$$;

create table if not exists public.clients (
  id          uuid primary key default extensions.gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  whatsapp    text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clients_workshop_whatsapp_unique unique (workshop_id, whatsapp)
);
create index if not exists clients_workshop_idx on public.clients (workshop_id, first_name);

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
drop policy if exists "admin can read clients" on public.clients;
create policy "admin can read clients"
  on public.clients for select
  using (public.is_admin() and workshop_id = public.current_workshop_id());

alter table public.orders
  add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists orders_client_idx on public.orders (client_id);

-- Relleno: un cliente por WhatsApp distinto en cada taller, con el nombre de
-- su orden más reciente.
insert into public.clients (workshop_id, first_name, last_name, whatsapp, created_at)
select distinct on (o.workshop_id, public.wa_digits(o.client_whatsapp))
  o.workshop_id, o.client_first_name, o.client_last_name,
  public.wa_digits(o.client_whatsapp), o.created_at
from public.orders o
where public.wa_digits(o.client_whatsapp) is not null
order by o.workshop_id, public.wa_digits(o.client_whatsapp), o.created_at desc
on conflict (workshop_id, whatsapp) do nothing;

update public.orders o
set client_id = c.id
from public.clients c
where o.client_id is null
  and c.workshop_id = o.workshop_id
  and c.whatsapp = public.wa_digits(o.client_whatsapp);

-- Cada orden nueva (o con el WhatsApp cambiado) queda enlazada a su cliente,
-- que se crea si no existe. Así ninguna API tiene que acordarse de hacerlo.
create or replace function public.orders_link_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wa  text;
  cid uuid;
begin
  wa := public.wa_digits(new.client_whatsapp);
  if wa is null then
    new.client_id := null;
    return new;
  end if;

  insert into public.clients (workshop_id, first_name, last_name, whatsapp)
  values (new.workshop_id, coalesce(new.client_first_name, ''), coalesce(new.client_last_name, ''), wa)
  on conflict (workshop_id, whatsapp)
    do update set first_name = excluded.first_name, last_name = excluded.last_name
  returning id into cid;

  new.client_id := cid;
  return new;
end;
$$;

drop trigger if exists trg_orders_link_client on public.orders;
create trigger trg_orders_link_client
  before insert or update of client_whatsapp, client_first_name, client_last_name on public.orders
  for each row execute function public.orders_link_client();

-- ============================================================================
-- 4. Recordatorios
-- ============================================================================
-- Etiquetas: workshop_id null = de la plataforma (se editan en «Interfaz
-- talleres» del superadmin); con workshop_id = creadas por ese taller.
create table if not exists public.reminder_tags (
  id          uuid primary key default extensions.gen_random_uuid(),
  workshop_id uuid references public.workshops (id) on delete cascade,
  label       text not null check (btrim(label) <> ''),
  color       text not null default 'gold',
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists reminder_tags_workshop_idx on public.reminder_tags (workshop_id, sort);

insert into public.reminder_tags (workshop_id, label, color, sort)
select null, v.label, v.color, v.sort
from (values
  ('Mantenimiento', 'blue', 1),
  ('Montar repuesto', 'gold', 2),
  ('Cambio de aceite', 'green', 3),
  ('Diagnóstico', 'red', 4)
) as v(label, color, sort)
where not exists (
  select 1 from public.reminder_tags t where t.workshop_id is null and t.label = v.label
);

alter table public.reminder_tags enable row level security;
drop policy if exists "staff can read reminder tags" on public.reminder_tags;
create policy "staff can read reminder tags"
  on public.reminder_tags for select
  using (public.is_staff() and (workshop_id is null or workshop_id = public.current_workshop_id()));

create table if not exists public.reminders (
  id            uuid primary key default extensions.gen_random_uuid(),
  workshop_id   uuid not null references public.workshops (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  order_id      uuid references public.orders (id) on delete set null,
  title         text not null check (btrim(title) <> ''),
  body          text,
  -- Nota de voz en el bucket privado stage-files; null = no se conservó.
  audio_path    text,
  transcript    text,
  image_path    text,
  tag_id        uuid references public.reminder_tags (id) on delete set null,
  due_date      date not null,
  notify_offset text not null default 'mismo_dia'
                check (notify_offset in ('mismo_dia', '3_dias', '7_dias', '1_mes')),
  -- Día en que se avisa al taller; lo calcula el trigger.
  notify_on     date not null,
  status        text not null default 'pendiente'
                check (status in ('pendiente', 'enviado', 'hecho')),
  sent_at       timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reminders_workshop_due_idx on public.reminders (workshop_id, due_date);
create index if not exists reminders_workshop_notify_idx on public.reminders (workshop_id, notify_on, status);
create index if not exists reminders_client_idx on public.reminders (client_id);

create or replace function public.reminders_set_notify_on()
returns trigger
language plpgsql
as $$
begin
  new.notify_on := case new.notify_offset
    when '3_dias' then new.due_date - 3
    when '7_dias' then new.due_date - 7
    when '1_mes'  then (new.due_date - interval '1 month')::date
    else new.due_date
  end;
  return new;
end;
$$;

drop trigger if exists trg_reminders_notify_on on public.reminders;
create trigger trg_reminders_notify_on
  before insert or update of due_date, notify_offset on public.reminders
  for each row execute function public.reminders_set_notify_on();

drop trigger if exists trg_reminders_updated_at on public.reminders;
create trigger trg_reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;
drop policy if exists "admin can read reminders" on public.reminders;
create policy "admin can read reminders"
  on public.reminders for select
  using (public.is_admin() and workshop_id = public.current_workshop_id());

-- ============================================================================
-- 5. Condiciones previas del vehículo
-- ============================================================================
create table if not exists public.vehicle_condition_items (
  id          uuid primary key default extensions.gen_random_uuid(),
  group_name  text not null check (btrim(group_name) <> ''),
  label       text not null check (btrim(label) <> ''),
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.vehicle_condition_items (group_name, label, sort)
select v.g, v.l, v.s
from (values
  ('Carrocería', 'Rayones', 101),
  ('Carrocería', 'Abolladuras', 102),
  ('Carrocería', 'Golpe en parachoques delantero', 103),
  ('Carrocería', 'Golpe en parachoques trasero', 104),
  ('Carrocería', 'Pintura dañada o descolorida', 105),
  ('Carrocería', 'Óxido visible', 106),
  ('Vidrios y espejos', 'Parabrisas astillado o roto', 201),
  ('Vidrios y espejos', 'Vidrios laterales dañados', 202),
  ('Vidrios y espejos', 'Espejos rotos o faltantes', 203),
  ('Luces', 'Faros delanteros no funcionan', 301),
  ('Luces', 'Luces de freno no funcionan', 302),
  ('Luces', 'Direccionales no funcionan', 303),
  ('Luces', 'Luces del tablero (testigos) encendidas', 304),
  ('Neumáticos', 'Neumáticos desgastados', 401),
  ('Neumáticos', 'Rin dañado', 402),
  ('Neumáticos', 'Trae caucho de repuesto', 403),
  ('Neumáticos', 'Trae gato y llave de rueda', 404),
  ('Interior', 'Tapicería rota o manchada', 501),
  ('Interior', 'Tablero dañado', 502),
  ('Interior', 'Aire acondicionado no enfría', 503),
  ('Interior', 'Radio o pantalla no funciona', 504),
  ('Interior', 'Alfombras presentes', 505),
  ('Mecánica visible', 'Fuga de aceite', 601),
  ('Mecánica visible', 'Fuga de refrigerante', 602),
  ('Mecánica visible', 'Ruido anormal al encender', 603),
  ('Mecánica visible', 'Batería débil', 604),
  ('Accesorios y documentos', 'Antena', 701),
  ('Accesorios y documentos', 'Tapa de gasolina', 702),
  ('Accesorios y documentos', 'Llave de repuesto', 703),
  ('Accesorios y documentos', 'Documentos del vehículo en la guantera', 704),
  ('Accesorios y documentos', 'Objetos de valor dentro (anotar cuáles)', 705)
) as v(g, l, s)
where not exists (select 1 from public.vehicle_condition_items);

alter table public.vehicle_condition_items enable row level security;
drop policy if exists "staff can read condition items" on public.vehicle_condition_items;
create policy "staff can read condition items"
  on public.vehicle_condition_items for select
  using (public.is_staff());

-- Lo marcado en cada orden se guarda como COPIA del texto, así editar la
-- lista después no cambia las órdenes viejas:
--   [{ "group": "Carrocería", "label": "Rayones", "note": "puerta trasera" }]
alter table public.orders
  add column if not exists vehicle_conditions jsonb not null default '[]'::jsonb,
  add column if not exists mileage integer,
  add column if not exists fuel_level text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_fuel_level_valid') then
    alter table public.orders add constraint orders_fuel_level_valid
      check (fuel_level is null or fuel_level in ('reserva', '1/4', '1/2', '3/4', 'lleno'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_mileage_valid') then
    alter table public.orders add constraint orders_mileage_valid
      check (mileage is null or (mileage >= 0 and mileage < 10000000));
  end if;
end $$;

-- ============================================================================
-- 6. Uso del asistente IA (freno contra abuso y gasto por taller)
-- ============================================================================
create table if not exists public.ai_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  workshop_id   uuid not null references public.workshops (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(10,5) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists ai_requests_workshop_idx on public.ai_requests (workshop_id, created_at desc);

alter table public.ai_requests enable row level security;
-- Sin políticas: solo la clave de servicio la lee y la escribe.
