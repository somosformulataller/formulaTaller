-- ============================================================================
-- 0024 — Condiciones previas del vehículo por nota de voz
--
-- Al crear la orden, el administrador graba una nota de voz y la app la pasa a
-- texto quedándose solo con lo que habla del estado del carro al recibirlo
-- (golpes, rayones, kilometraje, combustible…). Ese texto redactado se guarda
-- aquí. La lista de casillas de la 0023 sigue igual en la orden ya creada.
-- ============================================================================

alter table public.orders
  add column if not exists vehicle_notes text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_vehicle_notes_len') then
    alter table public.orders add constraint orders_vehicle_notes_len
      check (vehicle_notes is null or char_length(vehicle_notes) <= 2000);
  end if;
end $$;
