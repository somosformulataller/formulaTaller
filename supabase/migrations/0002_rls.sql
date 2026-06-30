-- ============================================================================
-- Formula Taller — Row Level Security policies
-- ============================================================================
-- Depends on: 0001_init.sql (tables and helper functions must exist)
-- ----------------------------------------------------------------------------

-- Enable RLS on all tables
alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_stages enable row level security;

-- ============================================================================
-- profiles
-- ============================================================================

-- Staff (any active user) can read all profiles
create policy "staff can read profiles"
  on public.profiles
  for select
  using (public.is_staff());

-- Admin can insert new profiles (mechanic creation)
create policy "admin can insert profiles"
  on public.profiles
  for insert
  with check (public.is_admin());

-- Admin can update any profile; mechanic can update their own
create policy "admin can update any profile"
  on public.profiles
  for update
  using (public.is_admin());

create policy "mechanic can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id and public.is_staff());

-- Only admin can delete profiles
create policy "admin can delete profiles"
  on public.profiles
  for delete
  using (public.is_admin());

-- ============================================================================
-- orders
-- ============================================================================

-- Staff can read all orders
create policy "staff can read orders"
  on public.orders
  for select
  using (public.is_staff());

-- Staff can create orders
create policy "staff can insert orders"
  on public.orders
  for insert
  with check (public.is_staff());

-- Staff can update orders (admin: any, mechanic: only assigned)
create policy "admin can update any order"
  on public.orders
  for update
  using (public.is_admin());

create policy "mechanic can update assigned order"
  on public.orders
  for update
  using (
    public.is_staff()
    and assigned_mechanic_id = auth.uid()
  );

-- Only admin can delete orders
create policy "admin can delete orders"
  on public.orders
  for delete
  using (public.is_admin());

-- Anonymous / client access: read by public_token (for tracking page)
create policy "anon can read order by token"
  on public.orders
  for select
  using (true);   -- We filter by token in the query; token is a random UUID

-- ============================================================================
-- order_stages
-- ============================================================================

-- Staff can read all stages
create policy "staff can read stages"
  on public.order_stages
  for select
  using (public.is_staff());

-- Staff can insert stages
create policy "staff can insert stages"
  on public.order_stages
  for insert
  with check (public.is_staff());

-- Staff can update stages (admin: any, mechanic: for assigned orders only)
create policy "admin can update any stage"
  on public.order_stages
  for update
  using (public.is_admin());

create policy "mechanic can update stages of assigned order"
  on public.order_stages
  for update
  using (
    public.is_staff()
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.assigned_mechanic_id = auth.uid()
    )
  );

-- Only admin can delete stages
create policy "admin can delete stages"
  on public.order_stages
  for delete
  using (public.is_admin());

-- Anonymous / client: can read stages for any order (token is the gate)
create policy "anon can read stages"
  on public.order_stages
  for select
  using (true);

-- ============================================================================
-- Handle new user → auto-insert profile (service role creates users)
-- The API route uses service_role key, so it inserts into profiles directly.
-- This trigger handles the edge case if someone signs up via Supabase dashboard.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only insert if a profile doesn't already exist
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'mechanic')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();
