-- Customer profiles, saved carts, and WhatsApp order requests.
-- Apply after 09-admin-only-access.sql. This does not grant customers admin access.
-- Policies use the auth.uid() from each request's JWT; browser session separation is configured by the app.

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null check (length(trim(phone)) > 0),
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_carts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles (user_id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_address text not null,
  order_note text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'whatsapp_requested'
    check (status in ('whatsapp_requested', 'confirmed', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists customer_orders_user_created_at_idx
  on public.customer_orders (user_id, created_at desc);
create index if not exists customer_orders_created_at_idx
  on public.customer_orders (created_at desc);
create index if not exists customer_profiles_created_at_idx
  on public.customer_profiles (created_at desc);

alter table public.customer_profiles enable row level security;
alter table public.customer_carts enable row level security;
alter table public.customer_orders enable row level security;

revoke all on public.customer_profiles, public.customer_carts, public.customer_orders
  from public, anon, authenticated;
grant select on public.customer_profiles to authenticated;
grant update (full_name, phone, address) on public.customer_profiles to authenticated;
grant select on public.customer_carts to authenticated;
grant insert (user_id, items), update (user_id, items), delete on public.customer_carts to authenticated;
grant select on public.customer_orders to authenticated;

drop policy if exists "Customers and admins can read customer profiles" on public.customer_profiles;
create policy "Customers and admins can read customer profiles"
  on public.customer_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_petify_admin());

drop policy if exists "Customers can update their own profile" on public.customer_profiles;
create policy "Customers can update their own profile"
  on public.customer_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.touch_customer_profile()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_customer_profile() from public, anon, authenticated;
drop trigger if exists customer_profile_updated_at on public.customer_profiles;
create trigger customer_profile_updated_at
  before update on public.customer_profiles
  for each row execute function public.touch_customer_profile();

create or replace function public.touch_customer_cart()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_customer_cart() from public, anon, authenticated;
drop trigger if exists customer_cart_updated_at on public.customer_carts;
create trigger customer_cart_updated_at
  before update on public.customer_carts
  for each row execute function public.touch_customer_cart();

drop policy if exists "Customers can manage their own cart" on public.customer_carts;
create policy "Customers can manage their own cart"
  on public.customer_carts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Customers and admins can read customer orders" on public.customer_orders;
create policy "Customers and admins can read customer orders"
  on public.customer_orders for select to authenticated
  using (user_id = (select auth.uid()) or public.is_petify_admin());

create or replace function public.create_customer_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_account_type text := lower(coalesce(new.raw_user_meta_data ->> 'account_type', ''));
begin
  if v_account_type = 'customer' then
    insert into public.customer_profiles (user_id, email, full_name, phone, address)
    values (
      new.id,
      lower(trim(new.email)),
      trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'phone', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'address', ''))
    );
  elsif nullif(trim(new.email), '') is not null then
    insert into public.access_requests (user_id, email)
    values (new.id, lower(trim(new.email)))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.create_customer_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists petify_create_access_request_on_signup on auth.users;
create trigger petify_create_customer_profile_on_signup
  after insert on auth.users
  for each row execute function public.create_customer_profile_for_auth_user();

create or replace function public.sync_customer_email_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  update public.customer_profiles
  set email = lower(trim(new.email)), updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_customer_email_for_auth_user() from public, anon, authenticated;
drop trigger if exists petify_sync_customer_email on auth.users;
create trigger petify_sync_customer_email
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_customer_email_for_auth_user();

create or replace function public.create_customer_order(
  p_items jsonb,
  p_delivery_address text,
  p_order_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.customer_profiles%rowtype;
  v_product public.products%rowtype;
  v_line jsonb;
  v_variant jsonb;
  v_product_id text;
  v_variant_id text;
  v_quantity integer;
  v_price_text text;
  v_price numeric(12, 2);
  v_expected_price numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_address text := trim(coalesce(p_delivery_address, ''));
  v_note text := trim(coalesce(p_order_note, ''));
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to place an order.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'The order items are invalid.';
  end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'The order must contain between 1 and 100 items.';
  end if;
  if length(v_address) < 5 or length(v_address) > 500 then
    raise exception 'Enter a delivery address between 5 and 500 characters.';
  end if;
  if length(v_note) > 500 then
    raise exception 'Order notes cannot exceed 500 characters.';
  end if;

  select * into v_profile
  from public.customer_profiles
  where user_id = v_user_id;
  if not found or length(trim(v_profile.full_name)) = 0 or length(trim(v_profile.phone)) = 0 then
    raise exception 'Complete your customer name and phone number before ordering.';
  end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'An order item is invalid.';
    end if;

    v_product_id := nullif(trim(v_line ->> 'product_id'), '');
    v_variant_id := coalesce(v_line ->> 'variant_id', '');
    if v_product_id is null then
      raise exception 'An order item is missing its product.';
    end if;
    begin
      v_quantity := (v_line ->> 'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'An order item has an invalid quantity.';
    end;
    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Item quantities must be between 1 and 99.';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id and is_active = true;
    if not found then
      raise exception 'A product in your cart is no longer available.';
    end if;

    v_variant := null;
    if jsonb_array_length(v_product.variants) > 0 then
      select variant_options.value into v_variant
      from jsonb_array_elements(v_product.variants) as variant_options(value)
      where variant_options.value ->> 'id' = v_variant_id
      limit 1;
      if v_variant is null then
        raise exception 'A selected product option is no longer available.';
      end if;
      v_price_text := regexp_replace(coalesce(v_variant ->> 'price', ''), '[^0-9.]', '', 'g');
    else
      if v_variant_id <> '' then
        raise exception 'A selected product option is no longer available.';
      end if;
      v_price_text := regexp_replace(coalesce(v_product.price, ''), '[^0-9.]', '', 'g');
    end if;

    if v_price_text !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      if coalesce((v_line ->> 'allow_unpriced')::boolean, false)
        and v_variant is null
        and coalesce(v_product.variants, '[]'::jsonb) = '[]'::jsonb then
        v_price := 0;
      else
        raise exception 'A product price is unavailable. Refresh your cart and try again.';
      end if;
    else
      v_price := v_price_text::numeric(12, 2);
      if v_price <= 0 and not (
        coalesce((v_line ->> 'allow_unpriced')::boolean, false)
        and v_variant is null
        and coalesce(v_product.variants, '[]'::jsonb) = '[]'::jsonb
      ) then
        raise exception 'A product price is unavailable. Refresh your cart and try again.';
      end if;
    end if;

    if v_line ? 'expected_unit_price' and (v_line -> 'expected_unit_price') <> 'null'::jsonb then
      begin
        v_expected_price := (v_line ->> 'expected_unit_price')::numeric(12, 2);
      exception when invalid_text_representation then
        raise exception 'An order item has an invalid expected price.';
      end;
      if v_expected_price <> v_price then
        raise exception 'A product price changed. Refresh your cart and try again.';
      end if;
    end if;
    if v_line ? 'expected_title' and (v_line ->> 'expected_title') is distinct from v_product.title then
      raise exception 'A product changed. Refresh the catalog and try again.';
    end if;
    if v_line ? 'expected_variant_label'
      and (v_line ->> 'expected_variant_label') is distinct from coalesce(v_variant ->> 'label', '') then
      raise exception 'A product option changed. Refresh the catalog and try again.';
    end if;

    v_total := v_total + (v_price * v_quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'title', v_product.title,
      'variant_id', v_variant_id,
      'variant_label', coalesce(v_variant ->> 'label', ''),
      'quantity', v_quantity,
      'unit_price', v_price,
      'line_total', v_price * v_quantity
    ));
  end loop;

  update public.customer_profiles
  set address = v_address, updated_at = now()
  where user_id = v_user_id;

  insert into public.customer_orders (
    user_id, customer_name, customer_email, customer_phone, delivery_address,
    order_note, items, total
  )
  values (
    v_user_id, v_profile.full_name, v_profile.email, v_profile.phone, v_address,
    v_note, v_order_items, v_total
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.create_customer_order(jsonb, text, text) from public, anon;
grant execute on function public.create_customer_order(jsonb, text, text) to authenticated;
