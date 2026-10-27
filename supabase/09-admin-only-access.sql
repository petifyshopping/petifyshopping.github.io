create or replace function public.get_my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_is_admin boolean;
  v_status text;
begin
  select exists (
    select 1 from public.admin_users where user_id = v_user_id
  ) into v_is_admin;

  if v_is_admin then
    v_status := 'approved';
  else
    select case
      when request.status in ('pending', 'rejected') then request.status
      else 'none'
    end
    into v_status
    from public.access_requests as request
    where request.user_id = v_user_id
    order by request.requested_at desc
    limit 1;
    v_status := coalesce(v_status, 'none');
  end if;

  return jsonb_build_object(
    'is_admin', coalesce(v_is_admin, false),
    'status', v_status
  );
end;
$$;

revoke all on function public.get_my_access() from public, anon;
grant execute on function public.get_my_access() to authenticated;
