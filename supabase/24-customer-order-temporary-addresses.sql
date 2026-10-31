-- Allow a signed-in customer to place an order with either a saved address
-- or an address used only for this order.

create or replace function public.create_customer_order_for_delivery(
  p_items jsonb,
  p_address_id uuid default null,
  p_order_note text default '',
  p_temporary_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_address text;
  v_is_temporary boolean;
  v_profile_address text;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to place an order.' using errcode = '42501';
  end if;

  if p_address_id is not null and nullif(trim(p_temporary_address), '') is not null then
    raise exception 'Choose either a saved address or a one-time delivery address.';
  end if;

  v_is_temporary := nullif(trim(p_temporary_address), '') is not null;

  if v_is_temporary then
    v_address := trim(p_temporary_address);
    if length(v_address) < 5 or length(v_address) > 500 then
      raise exception 'Enter a delivery address between 5 and 500 characters.';
    end if;
    select address
    into v_profile_address
    from public.customer_profiles
    where user_id = v_user_id
    for update;
    if not found then
      raise exception 'Your customer profile could not be found.';
    end if;
  else
    if p_address_id is null then
      raise exception 'Choose a saved address or enter a one-time delivery address.';
    end if;

    select address into v_address
    from public.customer_addresses
    where id = p_address_id
      and user_id = v_user_id;

    if not found then
      raise exception 'Select one of your saved delivery addresses.' using errcode = '42501';
    end if;
  end if;

  v_order_id := public.create_customer_order(p_items, v_address, p_order_note);
  if v_is_temporary then
    update public.customer_profiles
    set address = v_profile_address
    where user_id = v_user_id;
  end if;

  return v_order_id;
end;
$$;

revoke all on function public.create_customer_order_for_delivery(jsonb, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_customer_order_for_delivery(jsonb, uuid, text, text)
  to authenticated;
