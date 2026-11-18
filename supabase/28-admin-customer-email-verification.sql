-- Let admins check customer email confirmation status without exposing auth.users.
-- Apply after 27-customer-order-deletion.sql.

create or replace function public.get_admin_customer_email_verification(p_user_ids uuid[])
returns table (user_id uuid, email_verified boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can view customer email verification status.'
      using errcode = '42501';
  end if;

  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;
  if cardinality(p_user_ids) > 100 then
    raise exception 'Customer email verification lookup is too large.';
  end if;

  return query
  select users.id, users.email_confirmed_at is not null
  from auth.users as users
  join public.customer_profiles as profiles on profiles.user_id = users.id
  where users.id = any(p_user_ids);
end;
$$;

revoke all on function public.get_admin_customer_email_verification(uuid[]) from public, anon;
grant execute on function public.get_admin_customer_email_verification(uuid[]) to authenticated;
