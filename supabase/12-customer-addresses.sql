-- Up to three saved delivery addresses per customer.
-- Apply after 11-customer-accounts.sql.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles (user_id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 40),
  address text not null check (length(trim(address)) between 5 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_created_idx
  on public.customer_addresses (user_id, created_at, id);
create unique index if not exists customer_addresses_legacy_backfill_idx
  on public.customer_addresses (user_id, label, address);

insert into public.customer_addresses (user_id, label, address)
select user_id, 'Home', trim(address)
from public.customer_profiles
where length(trim(address)) between 5 and 500
on conflict do nothing;

alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from public, anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;

drop policy if exists "Customers can read their own addresses" on public.customer_addresses;
create policy "Customers can read their own addresses"
  on public.customer_addresses for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Customers can add their own addresses" on public.customer_addresses;
create policy "Customers can add their own addresses"
  on public.customer_addresses for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Customers can update their own addresses" on public.customer_addresses;
create policy "Customers can update their own addresses"
  on public.customer_addresses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Customers can delete their own addresses" on public.customer_addresses;
create policy "Customers can delete their own addresses"
  on public.customer_addresses for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.enforce_customer_address_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_address_count integer;
begin
  if tg_op = 'INSERT' then
    perform 1
    from public.customer_profiles
    where user_id = new.user_id
    for update;

    if not found then
      raise exception 'Your customer profile could not be found.';
    end if;

    select count(*) into v_address_count
    from public.customer_addresses
    where user_id = new.user_id;

    if v_address_count >= 3 and not exists (
      select 1
      from public.customer_addresses
      where user_id = new.user_id
        and label = new.label
        and address = new.address
    ) then
      raise exception 'You can save up to three delivery addresses. Edit or delete an address to add another.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.enforce_customer_address_limit() from public, anon, authenticated;
drop trigger if exists customer_address_limit on public.customer_addresses;
create trigger customer_address_limit
  before insert or update on public.customer_addresses
  for each row execute function public.enforce_customer_address_limit();

create or replace function public.create_customer_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_account_type text := lower(coalesce(new.raw_user_meta_data ->> 'account_type', ''));
  v_address text := trim(coalesce(new.raw_user_meta_data ->> 'address', ''));
begin
  if v_account_type = 'customer' then
    insert into public.customer_profiles (user_id, email, full_name, phone, address)
    values (
      new.id,
      lower(trim(new.email)),
      trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'phone', '')),
      v_address
    );

    if length(v_address) between 5 and 500 then
      insert into public.customer_addresses (user_id, label, address)
      values (new.id, 'Home', v_address)
      on conflict (user_id, label, address) do nothing;
    end if;
  elsif nullif(trim(new.email), '') is not null then
    insert into public.access_requests (user_id, email)
    values (new.id, lower(trim(new.email)))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.create_customer_profile_for_auth_user() from public, anon, authenticated;

create or replace function public.create_customer_order_for_address(
  p_items jsonb,
  p_address_id uuid,
  p_order_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_address text;
begin
  if v_user_id is null then
    raise exception 'Sign in to place an order.' using errcode = '42501';
  end if;

  select address into v_address
  from public.customer_addresses
  where id = p_address_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Select one of your saved delivery addresses.' using errcode = '42501';
  end if;

  return public.create_customer_order(p_items, v_address, p_order_note);
end;
$$;

revoke all on function public.create_customer_order(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.create_customer_order_for_address(jsonb, uuid, text) from public, anon;
grant execute on function public.create_customer_order_for_address(jsonb, uuid, text) to authenticated;
