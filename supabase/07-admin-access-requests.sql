-- Apply after 01-core-schema.sql through 06-inventory-dashboard.sql, before 08-product-seed.sql.
-- This migration preserves current role rows and keeps admin-only actions protected.
-- Rollback: restore the prior Sales policies/functions from 04-sales.sql, 05-admin-sales-editing.sql,
-- and 06-inventory-dashboard.sql. Export pending requests before dropping this migration's trigger,
-- functions, and access_requests table; preserve existing admin_users and sales_users rows.

create or replace function public.has_sales_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_petify_admin()
    or exists (
      select 1
      from public.sales_users
      where user_id = (select auth.uid())
    );
$$;

revoke all on function public.has_sales_access() from public, anon;
grant execute on function public.has_sales_access() to authenticated;

-- Retain the old predicate as a compatibility wrapper for already-installed RPCs.
create or replace function public.is_petify_sales_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.has_sales_access();
$$;

revoke all on function public.is_petify_sales_user() from public, anon;
grant execute on function public.is_petify_sales_user() to authenticated;

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz
);

create unique index if not exists access_requests_one_pending_per_user
  on public.access_requests (user_id)
  where status = 'pending';

alter table public.access_requests enable row level security;
revoke all on public.access_requests from public, anon, authenticated;
grant select on public.access_requests to authenticated;

drop policy if exists "Users can read their own access requests" on public.access_requests;
create policy "Users can read their own access requests"
  on public.access_requests for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can manage all access requests" on public.access_requests;
create policy "Admins can manage all access requests"
  on public.access_requests for all to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

revoke insert, update, delete on public.admin_users from public, anon, authenticated;
revoke insert, update, delete on public.sales_users from public, anon, authenticated;
grant select on public.sales_users to authenticated;

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

create or replace function public.create_access_request_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if nullif(trim(new.email), '') is not null then
    insert into public.access_requests (user_id, email)
    values (new.id, lower(trim(new.email)))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.create_access_request_for_auth_user() from public, anon, authenticated;
drop trigger if exists petify_create_access_request_on_signup on auth.users;
create trigger petify_create_access_request_on_signup
  after insert on auth.users
  for each row execute function public.create_access_request_for_auth_user();

create or replace function public.request_access()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in before requesting workspace access.' using errcode = '42501';
  end if;

  select lower(trim(users.email))
  into v_email
  from auth.users as users
  where users.id = v_user_id;

  if nullif(v_email, '') is null then
    raise exception 'A verified account email is required to request access.';
  end if;

  select request.id
  into v_request_id
  from public.access_requests as request
  where request.user_id = v_user_id
    and request.status = 'pending'
  limit 1;

  if v_request_id is not null then
    return v_request_id;
  end if;

  insert into public.access_requests (user_id, email)
  values (v_user_id, v_email)
  on conflict do nothing
  returning id into v_request_id;
  if v_request_id is null then
    select request.id
    into v_request_id
    from public.access_requests as request
    where request.user_id = v_user_id
      and request.status = 'pending'
    limit 1;
  end if;
  return v_request_id;
end;
$$;

revoke all on function public.request_access() from public, anon;
grant execute on function public.request_access() to authenticated;

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
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', sales.user_id,
        'email', users.email,
        'created_at', sales.created_at
      ) order by sales.created_at)
      from public.sales_users as sales
      join auth.users as users on users.id = sales.user_id
      where not exists (
        select 1 from public.admin_users as admin where admin.user_id = sales.user_id
      )
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
  if v_role not in ('admin', 'sales') then
    raise exception 'Role must be admin or sales.';
  end if;

  select * into v_request
  from public.access_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'No pending access request was found.';
  end if;

  if v_role = 'admin' then
    insert into public.admin_users (user_id)
    values (v_request.user_id)
    on conflict (user_id) do nothing;
  else
    insert into public.sales_users (user_id)
    values (v_request.user_id)
    on conflict (user_id) do nothing;
  end if;

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

create or replace function public.reject_access_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can reject workspace access.' using errcode = '42501';
  end if;

  update public.access_requests
  set status = 'rejected',
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'No pending access request was found.';
  end if;
end;
$$;

revoke all on function public.reject_access_request(uuid) from public, anon;
grant execute on function public.reject_access_request(uuid) to authenticated;

create or replace function public.revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_admin_count bigint;
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can revoke admin access.' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot revoke your own admin access.';
  end if;

  perform pg_advisory_xact_lock(74201961);
  select count(*) into v_admin_count from public.admin_users;
  if v_admin_count <= 1 then
    raise exception 'The last remaining admin cannot be revoked.';
  end if;

  delete from public.admin_users where user_id = p_user_id;
  if not found then
    raise exception 'Admin access was not found for that account.';
  end if;
end;
$$;

revoke all on function public.revoke_admin(uuid) from public, anon;
grant execute on function public.revoke_admin(uuid) to authenticated;

create or replace function public.revoke_sales_access(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can revoke Sales access.' using errcode = '42501';
  end if;

  delete from public.sales_users where user_id = p_user_id;
  if not found then
    raise exception 'Sales access was not found for that account.';
  end if;
end;
$$;

revoke all on function public.revoke_sales_access(uuid) from public, anon;
grant execute on function public.revoke_sales_access(uuid) to authenticated;

drop policy if exists "Workspace owners can read permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can read permitted drafts"
  on public.workspace_drafts for select to authenticated
  using (
    user_id = (select auth.uid())
    and (
      (draft_type = 'sale' and public.has_sales_access())
      or (draft_type <> 'sale' and public.is_petify_admin())
    )
  );

drop policy if exists "Workspace owners can create permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can create permitted drafts"
  on public.workspace_drafts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (draft_type = 'sale' and public.has_sales_access())
      or (draft_type <> 'sale' and public.is_petify_admin())
    )
  );

drop policy if exists "Workspace owners can update permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can update permitted drafts"
  on public.workspace_drafts for update to authenticated
  using (
    user_id = (select auth.uid())
    and (
      (draft_type = 'sale' and public.has_sales_access())
      or (draft_type <> 'sale' and public.is_petify_admin())
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      (draft_type = 'sale' and public.has_sales_access())
      or (draft_type <> 'sale' and public.is_petify_admin())
    )
  );

drop policy if exists "Workspace owners can delete permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can delete permitted drafts"
  on public.workspace_drafts for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (
      (draft_type = 'sale' and public.has_sales_access())
      or (draft_type <> 'sale' and public.is_petify_admin())
    )
  );

drop policy if exists "Petify admins manage business customers" on public.business_customers;
drop policy if exists "Petify sales users manage business customers" on public.business_customers;
create policy "Petify sales users manage business customers"
  on public.business_customers for all to authenticated
  using (public.has_sales_access())
  with check (public.has_sales_access());

drop policy if exists "Petify admins manage sales" on public.sales;
drop policy if exists "Petify sales users manage sales" on public.sales;
drop policy if exists "Petify sales users read sales" on public.sales;
drop policy if exists "Petify sales users create sales" on public.sales;
drop policy if exists "Petify sales users update sales" on public.sales;
drop policy if exists "Petify admins delete sales" on public.sales;
create policy "Petify sales users read sales"
  on public.sales for select to authenticated
  using (public.has_sales_access());
create policy "Petify sales users create sales"
  on public.sales for insert to authenticated
  with check (public.has_sales_access());
create policy "Petify sales users update sales"
  on public.sales for update to authenticated
  using (public.has_sales_access())
  with check (public.has_sales_access());
create policy "Petify admins delete sales"
  on public.sales for delete to authenticated
  using (public.is_petify_admin());

drop policy if exists "Petify admins manage sale items" on public.sale_items;
drop policy if exists "Petify sales users manage sale items" on public.sale_items;
drop policy if exists "Petify sales users read sale items" on public.sale_items;
drop policy if exists "Petify sales users create sale items" on public.sale_items;
drop policy if exists "Petify admins update sale items" on public.sale_items;
drop policy if exists "Petify admins delete sale items" on public.sale_items;
create policy "Petify sales users read sale items"
  on public.sale_items for select to authenticated
  using (public.has_sales_access());
create policy "Petify sales users create sale items"
  on public.sale_items for insert to authenticated
  with check (public.has_sales_access());
create policy "Petify admins update sale items"
  on public.sale_items for update to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());
create policy "Petify admins delete sale items"
  on public.sale_items for delete to authenticated
  using (public.is_petify_admin());

drop policy if exists "Petify admins manage sale payments" on public.sale_payments;
drop policy if exists "Petify sales users manage sale payments" on public.sale_payments;
create policy "Petify sales users manage sale payments"
  on public.sale_payments for all to authenticated
  using (public.has_sales_access())
  with check (public.has_sales_access());
