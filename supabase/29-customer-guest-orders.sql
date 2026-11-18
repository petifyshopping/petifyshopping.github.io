-- Allow customers to submit a WhatsApp order without creating an account.
-- Apply after 28-admin-customer-email-verification.sql.

alter table public.customer_orders
  alter column user_id drop not null;

create index if not exists customer_guest_orders_phone_created_at_idx
  on public.customer_orders (regexp_replace(customer_phone, '[^0-9]', '', 'g'), created_at desc)
  where user_id is null;

create or replace function public.create_customer_order_record(
  p_user_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_delivery_address text,
  p_order_note text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
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
  v_customer_name text := trim(coalesce(p_customer_name, ''));
  v_customer_email text := lower(trim(coalesce(p_customer_email, '')));
  v_customer_phone text := trim(coalesce(p_customer_phone, ''));
  v_address text := trim(coalesce(p_delivery_address, ''));
  v_note text := trim(coalesce(p_order_note, ''));
  v_order_id uuid;
begin
  if length(v_customer_name) < 1 or (p_user_id is null and length(v_customer_name) > 100) then
    raise exception 'Enter a name between 1 and 100 characters.';
  end if;
  if length(v_customer_phone) < 1
    or (p_user_id is null and (length(v_customer_phone) < 7 or length(v_customer_phone) > 30)) then
    raise exception 'Enter a valid phone or WhatsApp number.';
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

  if p_user_id is not null then
    update public.customer_profiles
    set address = v_address, updated_at = now()
    where user_id = p_user_id;
  end if;

  insert into public.customer_orders (
    user_id, customer_name, customer_email, customer_phone, delivery_address,
    order_note, items, total
  )
  values (
    p_user_id, v_customer_name, v_customer_email, v_customer_phone, v_address,
    v_note, v_order_items, v_total
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.create_customer_order_record(uuid, text, text, text, jsonb, text, text)
  from public, anon, authenticated;

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
begin
  if v_user_id is null then
    raise exception 'Sign in to place an order.' using errcode = '42501';
  end if;

  select * into v_profile
  from public.customer_profiles
  where user_id = v_user_id;
  if not found or length(trim(v_profile.full_name)) = 0 or length(trim(v_profile.phone)) = 0 then
    raise exception 'Complete your customer name and phone number before ordering.';
  end if;

  return public.create_customer_order_record(
    v_user_id,
    v_profile.full_name,
    v_profile.email,
    v_profile.phone,
    p_items,
    p_delivery_address,
    p_order_note
  );
end;
$$;

revoke all on function public.create_customer_order(jsonb, text, text) from public, anon;
grant execute on function public.create_customer_order(jsonb, text, text) to authenticated;

create or replace function public.create_guest_customer_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_order_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_phone_digits text := regexp_replace(v_phone, '[^0-9]', '', 'g');
  v_recent_orders bigint;
begin
  if length(v_phone_digits) < 7 or length(v_phone_digits) > 15 then
    raise exception 'Enter a valid phone or WhatsApp number.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_phone_digits, 0));
  select count(*) into v_recent_orders
  from public.customer_orders
  where user_id is null
    and regexp_replace(customer_phone, '[^0-9]', '', 'g') = v_phone_digits
    and created_at > now() - interval '10 minutes';
  if v_recent_orders >= 3 then
    raise exception 'Too many recent guest orders from this phone number. Please try again in a few minutes.';
  end if;

  return public.create_customer_order_record(
    null,
    p_customer_name,
    '',
    v_phone,
    p_items,
    p_delivery_address,
    p_order_note
  );
end;
$$;

revoke all on function public.create_guest_customer_order(jsonb, text, text, text, text) from public;
grant execute on function public.create_guest_customer_order(jsonb, text, text, text, text)
  to anon, authenticated;
