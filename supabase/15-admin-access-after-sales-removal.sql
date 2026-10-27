-- Apply after 10-remove-sales-backend.sql when Sales access has been removed.
-- Replace staff-access RPCs that still referenced the dropped sales_users table.

create or replace function public.get_access_team()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can view workspace access.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', admin.user_id,
        'email', users.email,
        'created_at', admin.created_at
      ) order by admin.created_at)
      from public.admin_users as admin
      join auth.users as users on users.id = admin.user_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_access_team() from public, anon;
grant execute on function public.get_access_team() to authenticated;

create or replace function public.approve_access_request(
  p_request_id uuid,
  p_role text default 'admin'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_request public.access_requests%rowtype;
  v_role text := lower(trim(coalesce(p_role, 'admin')));
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can approve workspace access.' using errcode = '42501';
  end if;
  if v_role <> 'admin' then
    raise exception 'Only admin access can be approved.';
  end if;

  select * into v_request
  from public.access_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'No pending access request was found.';
  end if;

  insert into public.admin_users (user_id)
  values (v_request.user_id)
  on conflict (user_id) do nothing;

  update public.access_requests
  set status = 'approved',
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = v_request.id;
end;
$$;

revoke all on function public.approve_access_request(uuid, text) from public, anon;
grant execute on function public.approve_access_request(uuid, text) to authenticated;

create or replace function public.approve_access_by_email(
  p_email text,
  p_role text default 'admin'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_request_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can approve workspace access.' using errcode = '42501';
  end if;

  select id into v_request_id
  from public.access_requests
  where lower(email) = v_email and status = 'pending'
  order by requested_at
  limit 1;

  if v_request_id is null then
    raise exception 'No pending access request exists for that email address.';
  end if;

  perform public.approve_access_request(v_request_id, p_role);
  return v_request_id;
end;
$$;

revoke all on function public.approve_access_by_email(text, text) from public, anon;
grant execute on function public.approve_access_by_email(text, text) to authenticated;

-- Remove policies that still depend on the legacy Sales access helpers.
-- Guard each relation because the Sales cleanup may already have dropped it.
do $$
begin
  if to_regclass('public.workspace_drafts') is not null then
    execute 'drop policy if exists "Workspace owners can read permitted drafts" on public.workspace_drafts';
    execute 'drop policy if exists "Workspace owners can create permitted drafts" on public.workspace_drafts';
    execute 'drop policy if exists "Workspace owners can update permitted drafts" on public.workspace_drafts';
    execute 'drop policy if exists "Workspace owners can delete permitted drafts" on public.workspace_drafts';
  end if;

  if to_regclass('public.business_customers') is not null then
    execute 'drop policy if exists "Petify sales users manage business customers" on public.business_customers';
  end if;
end;
$$;

drop function if exists public.revoke_sales_access(uuid);
drop function if exists public.is_petify_sales_user();
drop function if exists public.has_sales_access();
