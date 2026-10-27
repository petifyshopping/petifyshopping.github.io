-- Admin order status updates and aggregate customer-order stats.
-- Apply after 12-customer-addresses.sql. Does not grant customers admin access.

create or replace function public.update_customer_order_status(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can update customer order status.'
      using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('whatsapp_requested', 'confirmed', 'fulfilled', 'cancelled') then
    raise exception 'Choose a valid customer order status.';
  end if;

  update public.customer_orders
  set status = p_status
  where id = p_order_id;

  if not found then
    raise exception 'The customer order could not be found.';
  end if;
end;
$$;

revoke all on function public.update_customer_order_status(uuid, text) from public, anon;
grant execute on function public.update_customer_order_status(uuid, text) to authenticated;

create or replace function public.get_customer_order_stats()
returns table (
  total_orders bigint,
  requested_orders bigint,
  confirmed_orders bigint,
  fulfilled_orders bigint,
  cancelled_orders bigint,
  fulfilled_total numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can view customer order stats.'
      using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where status = 'whatsapp_requested')::bigint,
    count(*) filter (where status = 'confirmed')::bigint,
    count(*) filter (where status = 'fulfilled')::bigint,
    count(*) filter (where status = 'cancelled')::bigint,
    coalesce(sum(total) filter (where status = 'fulfilled'), 0)::numeric
  from public.customer_orders;
end;
$$;

revoke all on function public.get_customer_order_stats() from public, anon;
grant execute on function public.get_customer_order_stats() to authenticated;
